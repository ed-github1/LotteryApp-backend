import express from 'express'
import Order from '../models/order.js'
import User from '../models/user.js'
import {
  tokenExtractor,
  userExtractor,
  adminOnly
} from '../utils/middleware.js'
import logger from '../utils/logger.js'
import { getIO } from '../utils/socket.js'
import { getNextDrawDateForCountry } from './drawSchedule.js'

const lotteryRouter = express.Router()

// Helper to calculate draw date using the configured schedule (supports daily testing)
function getNextDrawDate() {
  // Use MX as the default country for lottery draws
  // Returns ISO string with timezone offset (local time)
  return getNextDrawDateForCountry('MX')
}

// Helper to check if orders are allowed (not past the cutoff time)
import { DateTime } from 'luxon'

function isOrderAllowed(drawDate) {
  // Get current time in Mexico City
  const now = DateTime.now().setZone('America/Mexico_City')
  // Parse drawDate as 'yyyy-MM-dd HH:mm:ss' in local time
  const drawDateLocal = DateTime.fromFormat(drawDate, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' })
  // Cutoff is 8pm local time (draw time)
  const cutoff = drawDateLocal.set({ hour: 20, minute: 0, second: 0, millisecond: 0 })
  // Allow orders up to 8pm local time
  return now < cutoff
}

// Helper to build query for status and date range
function buildOrderQuery({ status, startDate, endDate }) {
  const query = {}
  if (status) query.paymentStatus = status
  if (startDate || endDate) {
    query.purchasedDate = {}
    if (startDate) query.purchasedDate.$gte = new Date(startDate)
    if (endDate) query.purchasedDate.$lte = new Date(endDate)
  }
  return query
}

// Helper to paginate and sort orders
async function getOrdersByStatus({
  status,
  page = 1,
  limit = 10,
  startDate,
  endDate
}) {
  const query = buildOrderQuery({ status, startDate, endDate })
  logger.info(
    `${
      status.charAt(0).toUpperCase() + status.slice(1)
    } Orders Query: ${JSON.stringify(query, null, 2)}`
  )
  const orders = await Order.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ purchasedDate: -1 })
  logger.info(
    `${status.charAt(0).toUpperCase() + status.slice(1)} Orders Result Count: ${
      orders.length
    }`
  )
  const totalCount = await Order.countDocuments(query)
  return { orders, totalCount }
}

// GET /api/orders/next-draw - Get next draw information
lotteryRouter.get('/next-draw', async (req, res) => {
  try {
    let drawDateISO = getNextDrawDate()
    let drawDate
    if (DateTime.fromISO(drawDateISO).isValid) {
      drawDate = DateTime.fromISO(drawDateISO, { zone: 'America/Mexico_City' }).toFormat('yyyy-MM-dd HH:mm:ss')
    } else if (!isNaN(Date.parse(drawDateISO))) {
      drawDate = DateTime.fromJSDate(new Date(drawDateISO)).setZone('America/Mexico_City').toFormat('yyyy-MM-dd HH:mm:ss')
    } else {
      drawDate = drawDateISO
    }
    const ordersAllowed = isOrderAllowed(drawDate)
    // Cutoff time is 8pm local time
    const cutoffTime = DateTime.fromFormat(drawDate, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' }).toJSDate()
    res.json({
      drawDate,
      cutoffTime,
      ordersAllowed,
      message: ordersAllowed
        ? 'Orders are open for this draw'
        : 'Orders are closed. Cutoff time has passed.'
    })
  } catch (error) {
    logger.error('Error fetching next draw info:', error)
    res.status(500).json({ message: 'Error fetching next draw information' })
  }
})

// GET /api/orders/paid
lotteryRouter.get(
  '/paid',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      let { page = 1, limit = 20, startDate, endDate } = req.query

      // Validate and sanitize params
      const numericLimit =
        Number.isInteger(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : 20
      const numericPage =
        Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1
      if (startDate && isNaN(new Date(startDate))) startDate = undefined
      if (endDate && isNaN(new Date(endDate))) endDate = undefined

      const { orders, totalCount } = await getOrdersByStatus({
        status: 'paid',
        page: numericPage,
        limit: numericLimit,
        startDate,
        endDate
      })
      const totalPages = totalCount ? Math.ceil(totalCount / numericLimit) : 1
      res.json({ orders, totalPages, totalCount })
    } catch (error) {
      logger.error('Error fetching paid orders:', error)
      res.status(500).json({ message: 'Error fetching paid orders' })
    }
  }
)

// POST /api/orders
lotteryRouter.post('/', tokenExtractor, userExtractor, async (req, res) => {
  try {
    const { tickets, tkid, paymentMethod } = req.body
    const userId = req.user.id


  // Calculate the next draw date (ISO string with offset)

    let drawDateISO = getNextDrawDate()
    let drawDate
    // If drawDateISO is already in 'YYYY-MM-DD HH:mm:ss' format, use as is
    if (DateTime.fromISO(drawDateISO).isValid) {
      drawDate = DateTime.fromISO(drawDateISO, { zone: 'America/Mexico_City' }).toFormat('yyyy-MM-dd HH:mm:ss')
    } else if (!isNaN(Date.parse(drawDateISO))) {
      drawDate = DateTime.fromJSDate(new Date(drawDateISO)).setZone('America/Mexico_City').toFormat('yyyy-MM-dd HH:mm:ss')
    } else {
      drawDate = drawDateISO // fallback
    }

  // Debug: log current local time and assigned draw date (formatted)
  const nowLocal = DateTime.now().setZone('America/Mexico_City')
  logger.info(`[ORDER DEBUG] Now (America/Mexico_City): ${nowLocal.toISO()} | Assigned drawDate (formatted): ${drawDate}`)

    // Check if orders are still allowed (before cutoff time)
    if (!isOrderAllowed(drawDate)) {
      return res.status(400).json({
        message:
          'Orders are closed for this draw. The cutoff time has passed (1 hour before draw).',
        nextDrawDate: drawDate
      })
    }

    // Assign price to each ticket: 0.40 per selection
    const processedTickets = Array.isArray(tickets)
      ? tickets.map((ticket) => {
          const numSelections = ticket.selections
            ? Object.keys(ticket.selections).length
            : 0
          const price = 0.4 * numSelections
          return { ...ticket, price }
        })
      : []

    // Calculate total price from tickets array
    const totalAmount = processedTickets.reduce(
      (sum, ticket) => sum + (ticket.price || 0),
      0
    )

    const order = new Order({
      user: userId,
      tickets: processedTickets,
      tkid,
      total: totalAmount,
      paymentStatus: 'pending',
      paymentMethod,
      purchasedDate: new Date(),
      drawDate: drawDate, // ISO string with offset
      expired: false
    })

    await order.save()
    res.status(201).json(order)
  } catch (error) {
    logger.error('Error placing order:', error)
    res.status(500).json({ message: 'Error placing order' })
  }
})

// POST /api/orders/test - Create order for specific draw date (TESTING ONLY)
lotteryRouter.post('/test', tokenExtractor, userExtractor, async (req, res) => {
  try {
    const { tickets, tkid, paymentMethod, drawDate: customDrawDate } = req.body
    const userId = req.user.id

    // Use custom draw date if provided, otherwise use next draw
    let drawDateISO = customDrawDate ? customDrawDate : getNextDrawDate()
    let drawDate
    if (DateTime.fromISO(drawDateISO).isValid) {
      drawDate = DateTime.fromISO(drawDateISO, { zone: 'America/Mexico_City' }).toFormat('yyyy-MM-dd HH:mm:ss')
    } else if (!isNaN(Date.parse(drawDateISO))) {
      drawDate = DateTime.fromJSDate(new Date(drawDateISO)).setZone('America/Mexico_City').toFormat('yyyy-MM-dd HH:mm:ss')
    } else {
      drawDate = drawDateISO
    }

    // Assign price to each ticket: 0.40 per selection
    const processedTickets = Array.isArray(tickets)
      ? tickets.map((ticket) => {
          const numSelections = ticket.selections
            ? Object.keys(ticket.selections).length
            : 0
          const price = 0.4 * numSelections
          return { ...ticket, price }
        })
      : []

    // Calculate total price from tickets array
    const totalAmount = processedTickets.reduce(
      (sum, ticket) => sum + (ticket.price || 0),
      0
    )

    const order = new Order({
      user: userId,
      tickets: processedTickets,
      tkid,
      total: totalAmount,
      paymentStatus: 'pending',
      paymentMethod,
      purchasedDate: new Date(),
      drawDate: drawDate,
      expired: false
    })

    await order.save()
    res.status(201).json(order)
  } catch (error) {
    logger.error('Error placing test order:', error)
    res.status(500).json({ message: 'Error placing test order' })
  }
})

// GET /api/orders/pending
lotteryRouter.get(
  '/pending',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      let { page = 1, limit = 20, startDate, endDate } = req.query

      // Validate and sanitize params
      const numericLimit =
        Number.isInteger(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : 20
      const numericPage =
        Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1
      if (startDate && isNaN(new Date(startDate))) startDate = undefined
      if (endDate && isNaN(new Date(endDate))) endDate = undefined

      const { orders, totalCount } = await getOrdersByStatus({
        status: 'pending',
        page: numericPage,
        limit: numericLimit,
        startDate,
        endDate
      })
      const totalPages = totalCount ? Math.ceil(totalCount / numericLimit) : 1
      res.json({ orders, totalPages, totalCount })
    } catch (error) {
      logger.error('Error fetching pending orders:', error)
      res.status(500).json({ message: 'Error fetching pending orders' })
    }
  }
)

// GET /api/orders/rejected
lotteryRouter.get(
  '/rejected',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      let { page = 1, limit = 10, startDate, endDate } = req.query

      // Validate and sanitize params
      const numericLimit =
        Number.isInteger(Number(limit)) && Number(limit) > 0
          ? Number(limit)
          : 10
      const numericPage =
        Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1
      if (startDate && isNaN(new Date(startDate))) startDate = undefined
      if (endDate && isNaN(new Date(endDate))) endDate = undefined

      const { orders, totalCount } = await getOrdersByStatus({
        status: 'rejected',
        page: numericPage,
        limit: numericLimit,
        startDate,
        endDate
      })
      const totalPages = totalCount ? Math.ceil(totalCount / numericLimit) : 1
      res.json({ orders, totalPages, totalCount })
      logger.info(
        `Rejected Orders Response: ${JSON.stringify(
          { orders: orders.length, totalPages, totalCount },
          null,
          2
        )}`
      )
    } catch (error) {
      logger.error('Error fetching rejected orders:', error)
      res.status(500).json({ message: 'Error fetching rejected orders' })
    }
  }
)

// PATCH /api/orders/:id/validate
lotteryRouter.patch(
  '/:id/validate',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).populate('user')
      if (!order) return res.status(404).json({ message: 'Order not found' })

      order.paymentStatus = 'paid'
      order.purchasedDate = new Date()
      await order.save()

      // Increase user's credits by the number of tickets in the order when paid
      const ticketCount = Array.isArray(order.tickets)
        ? order.tickets.length
        : 0
      if (ticketCount > 0) {
        await User.findByIdAndUpdate(order.user._id, {
          $inc: { credits: ticketCount }
        })
      }

      // ✅ EMIT SOCKET EVENT
      try {
        const io = getIO()
        io.to(order.user._id.toString()).emit('orderStatusUpdate', {
          orderId: order._id.toString(),
          status: 'paid',
          message: `✅ Your order has been approved! ${ticketCount} ticket(s) added to your account.`,
          ticketCount,
          order: {
            id: order._id.toString(),
            total: order.total,
            tickets: ticketCount
          }
        })
        logger.info(
          `Socket event emitted to user ${order.user._id}: order approved`
        )
      } catch (socketError) {
        logger.error('Error emitting socket event:', socketError)
        // Continue even if socket fails
      }

      res.json({ message: 'Order marked as paid', order })
    } catch (error) {
      logger.error('Error validating order:', error)
      res.status(500).json({ message: 'Error validating order' })
    }
  }
)

// PATCH /api/orders/:id/reject
lotteryRouter.patch(
  '/:id/reject',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).populate('user')
      if (!order) return res.status(404).json({ message: 'Order not found' })

      order.paymentStatus = 'rejected'
      order.purchasedDate = new Date()
      await order.save()

      // ✅ EMIT SOCKET EVENT
      try {
        const io = getIO()
        io.to(order.user._id.toString()).emit('orderStatusUpdate', {
          orderId: order._id.toString(),
          status: 'rejected',
          message: `❌ Your order has been rejected. Please contact support for details.`,
          order: {
            id: order._id.toString(),
            total: order.total,
            tickets: order.tickets?.length || 0
          }
        })
        logger.info(
          `Socket event emitted to user ${order.user._id}: order rejected`
        )
      } catch (socketError) {
        logger.error('Error emitting socket event:', socketError)
        // Continue even if socket fails
      }

      res.json({ message: 'Order rejected', order })
    } catch (error) {
      logger.error('Error rejecting order:', error)
      res.status(500).json({ message: 'Error rejecting order' })
    }
  }
)

lotteryRouter.get(
  '/daily-revenue',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      const { month, year } = req.query
      if (!month || !year) {
        return res.status(400).json({ message: 'Month and year are required' })
      }

      // Parse month/year and build date range
      const m = parseInt(month, 10)
      const y = parseInt(year, 10)
      const startDate = new Date(y, m - 1, 1)
      const endDate = new Date(y, m, 0, 23, 59, 59, 999) // last day of month

      // Aggregate daily totals
      const dailyTotals = await Order.aggregate([
        {
          $match: {
            purchasedDate: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$purchasedDate' },
              month: { $month: '$purchasedDate' },
              year: { $year: '$purchasedDate' }
            },
            totalAmount: { $sum: '$amount' },
            orderCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.day': 1 }
        }
      ])

      res.json({ dailyTotals })
    } catch (error) {
      logger.error('Error fetching daily totals:', error)
      res.status(500).json({ message: 'Error fetching daily totals' })
    }
  }
)

// GET /api/orders/revenue
lotteryRouter.get(
  '/revenue',
  tokenExtractor,
  userExtractor,
  adminOnly,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ message: 'startDate and endDate are required' })
      }

      const start = new Date(startDate)
      const end = new Date(endDate)

      // Aggregate total revenue for paid orders in the date range
      const result = await Order.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            purchasedDate: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' }
          }
        }
      ])

      const revenue = result.length > 0 ? result[0].revenue : 0
      res.json({ revenue })
    } catch (error) {
      res.status(500).json({ message: 'Error fetching monthly revenue' })
    }
  }
)

// GET /api/orders/my
lotteryRouter.get('/my', tokenExtractor, userExtractor, async (req, res) => {
  try {
    const userId = req.user.id
    let { page = 1, limit = 20, startDate, endDate } = req.query

    const query = { user: userId }
    if (startDate || endDate) {
      query.purchasedDate = {}
      if (startDate) query.purchasedDate.$gte = new Date(startDate)
      if (endDate) query.purchasedDate.$lte = new Date(endDate)
    }

    const numericLimit =
      Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 20
    const numericPage =
      Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1

    const orders = await Order.find(query)
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .sort({ purchasedDate: -1 })

    const totalCount = await Order.countDocuments(query)
    const totalPages = totalCount ? Math.ceil(totalCount / numericLimit) : 1

    res.json({ orders, totalPages, totalCount })
  } catch (error) {
    logger.error('Error fetching user orders:', error)
    res.status(500).json({ message: 'Error fetching user orders' })
  }
})

export default lotteryRouter

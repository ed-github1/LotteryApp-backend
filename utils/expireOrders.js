import cron from 'node-cron'
import Order from '../models/order.js'

// Runs every day at midnight
cron.schedule('0 0 * * *', async () => {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Find all paid, not-yet-expired orders
  const orders = await Order.find({ paymentStatus: 'paid', expired: false })

  let expiredCount = 0

  for (const order of orders) {
    // Only expire if ALL tickets have FR drawDate and it's more than a week ago
    const allTicketsExpired = order.tickets.every(ticket => {
      const frDate = ticket.drawDate && ticket.drawDate.FR
      return frDate && new Date(frDate) <= weekAgo
    })

    if (allTicketsExpired && order.tickets.length > 0) {
      order.expired = true
      await order.save()
      expiredCount++
    }
  }

  if (expiredCount > 0) {
    console.log(`Expired ${expiredCount} orders.`)
  }
})
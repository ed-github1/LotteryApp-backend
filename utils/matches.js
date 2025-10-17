import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'

/**
 * winningNumbers: array of numbers, e.g. [29, 3, 20, 7, ...]
 */
export async function getUsersWithAnyMatches(winningNumbers) {
  // Fetch all orders with tickets and user populated
  const orders = await Order.find({}).populate('user')
  const userMatches = {}

  for (const order of orders) {
    for (const ticket of order.tickets) {
      let ticketNumbers = []

      // If selections is an array of objects
      if (Array.isArray(ticket.selections)) {
        ticketNumbers = ticket.selections.map((sel) => sel.number)
      }
      // If selections is an object (old format)
      if (
        typeof ticket.selections === 'object' &&
        !Array.isArray(ticket.selections)
      ) {
        ticketNumbers = Object.values(ticket.selections)
      }

      // Check for any match
      const hasMatch = ticketNumbers.some((num) => winningNumbers.includes(num))
      if (hasMatch) {
        const userId = order.user._id.toString()
        if (!userMatches[userId]) {
          userMatches[userId] = { user: order.user, matches: 0 }
        }
        userMatches[userId].matches += 1
      }
    }
  }

  // Return users with at least 1 match
  return Object.values(userMatches).filter((u) => u.matches > 0)
}

export async function getUsersWithAnyMatchesForDraw(drawDate) {
  // Convert input drawDate to start and end of day (UTC)
  const inputDate = new Date(drawDate)
  const startOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )
  const endOfDay = new Date(
    Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  )
  // Fetch all orders for that draw (any time on that day)
  const orders = await Order.find({
    drawDate: { $gte: startOfDay, $lte: endOfDay }
  }).populate('user')

  // 1. Fetch winning numbers for the draw (any time on that day)
  const winnerDoc = await WinnerNumber.findOne({
    drawDate: { $gte: startOfDay, $lte: endOfDay }
  })
  if (!winnerDoc) {
    console.log('No winnerDoc for drawDate:', drawDate)
    return []
  }

  // Convert winner numbers object to array of numbers (ensure all are numbers)
  const winningNumbers = Array.from(
    winnerDoc.winnerNumbers.values
      ? winnerDoc.winnerNumbers.values()
      : Object.values(winnerDoc.winnerNumbers)
  ).map(Number)

  // Return matches per ticket, not per user
  const ticketMatches = []
  for (const order of orders) {
    for (const ticket of order.tickets) {
      let ticketNumbers = []
      if (Array.isArray(ticket.selections)) {
        ticketNumbers = ticket.selections.map((sel) => sel.number)
      }
      if (
        typeof ticket.selections === 'object' &&
        !Array.isArray(ticket.selections)
      ) {
        ticketNumbers = Object.values(ticket.selections)
      }
      // Find which numbers match (ensure type consistency)
      const matchingNumbers = ticketNumbers
        .map(Number)
        .filter((num) => winningNumbers.includes(num))
      if (matchingNumbers.length > 0) {
        ticketMatches.push({
          orderId: order._id,
          user: order.user,
          ticketId: ticket._id,
          matchesCount: matchingNumbers.length,
          matches: matchingNumbers,
          ticketNumbers
        })
      }
    }
  }
  // Debug: print ticket matches
  console.log('Tickets with matches:', ticketMatches.length)
  ticketMatches.forEach((t) => {
    console.log(
      `User: ${t.user.username || t.user.email || t.user._id}, Ticket: ${
        t.ticketId
      }, Matches: ${t.matchesCount}, Matching Numbers: ${t.matches}`
    )
  })
  return ticketMatches
}

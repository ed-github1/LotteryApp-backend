import SuperballOrder from '../models/superballOrder.js'
import SuperballWinner from '../models/superballWinner.js'
import User from '../models/user.js'
import logger from './logger.js'

/**
 * Award Superball jackpot to winners
 * @param {Date} drawDate - The Superball draw date
 * @param {Number} winnerNumber - Single winning number (1-10)
 * @param {Number} jackpotAmount - Amount transferred from regular lottery
 * @returns {Object} Award results
 */
export async function awardSuperballWinners(drawDate, winnerNumber, jackpotAmount) {
  try {
    logger.info(`\n=== AWARDING SUPERBALL WINNERS ===`)
    logger.info(`Draw Date: ${drawDate.toISOString().split('T')[0]}`)
    logger.info(`Winner Number: ${winnerNumber}`)
    logger.info(`Jackpot Amount: $${jackpotAmount.toFixed(2)}`)

    // Get all Superball orders for this draw date
    const orders = await SuperballOrder.find({
      'tickets.drawDate': new Date(drawDate)
    }).populate('user')

    if (orders.length === 0) {
      logger.info('No Superball orders found for this draw')
      logger.info('Checking all Superball orders regardless of draw date...')
      
      // Check all orders (for testing purposes)
      const allOrders = await SuperballOrder.find().populate('user')
      
      if (allOrders.length === 0) {
        // Still create winner document with 0 winners
        await SuperballWinner.create({
          drawDate: new Date(drawDate),
          winnerNumber,
          jackpotAmount,
          totalWinners: 0,
          prizePerWinner: 0
        })

        return {
          totalWinners: 0,
          prizePerWinner: 0,
          jackpotAmount,
          winners: []
        }
      }
      
      // Use all orders
      orders.push(...allOrders)
    }

    // Find all winning tickets - if any of the 5 numbers matches the winner number
    const winners = []

    for (const order of orders) {
      for (const ticket of order.tickets) {
        // Check if ticket contains the winner number (any of the 5 numbers)
        if (ticket.numbers.includes(winnerNumber)) {
          winners.push({
            user: order.user,
            userId: order.user._id,
            ticket: ticket.numbers,
            orderId: order._id
          })
          logger.info(`  Winner found! User: ${order.user.email}, Numbers: ${ticket.numbers.join(', ')}, Hit: ${winnerNumber}`)
        }
      }
    }

    const totalWinners = winners.length
    const prizePerWinner = totalWinners > 0 ? jackpotAmount / totalWinners : 0

    logger.info(`\nTotal Winners: ${totalWinners}`)
    logger.info(`Prize Per Winner: $${prizePerWinner.toFixed(2)} USDT`)
    logger.info(`NOTE: USDT will be deposited to winner accounts within 48 hours`)

    // Create winner records (no immediate deposit)
    const winnerRecords = []
    if (totalWinners > 0) {
      for (const winner of winners) {
        winnerRecords.push({
          userId: winner.userId,
          email: winner.user.email,
          ticket: winner.ticket,
          prize: prizePerWinner,
          notified: true,
          depositPending: true
        })
        logger.info(`  Winner: ${winner.user.email} - $${prizePerWinner.toFixed(2)} USDT (Deposit pending)`)
      }
    }

    // Create Superball winner document
    await SuperballWinner.create({
      drawDate: new Date(drawDate),
      winnerNumber,
      jackpotAmount,
      totalWinners,
      prizePerWinner,
      winners: winnerRecords
    })

    logger.info(`\n✓ Superball winners notified successfully!`)
    logger.info(`💰 USDT deposits will be processed within 48 hours\n`)

    return {
      totalWinners,
      prizePerWinner,
      jackpotAmount,
      winnerNumber,
      winners: winnerRecords.map(w => ({
        userId: w.userId.toString(),
        email: w.email,
        ticket: w.ticket,
        prize: w.prize,
        status: 'Deposit pending (within 48 hours)'
      }))
    }
  } catch (error) {
    logger.error('Error awarding Superball winners:', error)
    throw error
  }
}

/**
 * Get current Superball jackpot (from latest triggered transfer)
 */
export async function getCurrentSuperballJackpot() {
  try {
    const WinnerNumber = (await import('../models/winnerNumber.js')).default
    
    // Find the most recent draw with a Superball transfer that hasn't been awarded yet
    const superballDraw = await WinnerNumber.findOne({
      superballTransfer: { $exists: true, $gt: 0 }
    }).sort({ drawDate: -1 })

    if (!superballDraw) {
      return null
    }

    // Check if this Superball has already been awarded
    const alreadyAwarded = await SuperballWinner.findOne({
      drawDate: { $gte: superballDraw.drawDate }
    })

    if (alreadyAwarded) {
      return null // Already awarded
    }

    return {
      amount: superballDraw.superballTransfer,
      triggeredDate: superballDraw.drawDate
    }
  } catch (error) {
    logger.error('Error getting current Superball jackpot:', error)
    return null
  }
}

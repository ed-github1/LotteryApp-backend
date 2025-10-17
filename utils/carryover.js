import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import logger from './logger.js'

const PRIZE_CATEGORIES = {
  1: { matches: 7, percentage: 0.9 }, // Cat 1 gets 90% of prize pool
  2: { matches: 6, percentage: 0.2 },
  3: { matches: 5, percentage: 0.15 },
  4: { matches: 4, percentage: 0.1 },
  5: { matches: 3, percentage: 0.08 },
  6: { matches: 2, percentage: 0.06 },
  7: { matches: 1, percentage: 0.045 },
  8: { matches: 0, percentage: 0.005 }
}

const BONUS_PERCENTAGE = 0.005

// Helper: Calculate matches for a ticket
function calculateMatches(selections, winnerNumbers) {
  let matches = 0
  let hasAdditional = Object.keys(selections).length === 8 || 'FR' in selections
  let bonusMatched = false

  if ('FR' in selections) {
    const ticketFR = Number(selections['FR'])
    let winnerFR
    if (winnerNumbers instanceof Map) {
      winnerFR = winnerNumbers.get('FR')
    } else {
      winnerFR = winnerNumbers['FR']
    }
    const winnerFRNum = Number(winnerFR)
    if (ticketFR === winnerFRNum) {
      bonusMatched = true
    }
  }

  const allMainCountries = ['CA', 'IT', 'MX', 'NZ', 'KR', 'IE', 'UK']
  let mainWinnerValues = []
  if (winnerNumbers instanceof Map) {
    for (const country of allMainCountries) {
      const val = winnerNumbers.get(country)
      if (val !== undefined && val !== null) {
        mainWinnerValues.push(Number(val))
      }
    }
  } else {
    for (const country of allMainCountries) {
      const val = winnerNumbers[country]
      if (val !== undefined && val !== null) {
        mainWinnerValues.push(Number(val))
      }
    }
  }

  const winnerSet = new Set(mainWinnerValues)
  const ticketMainValues = []
  for (const country of allMainCountries) {
    if (country in selections) {
      const val = selections[country]
      if (val !== undefined && val !== null) {
        ticketMainValues.push(Number(val))
      }
    }
  }

  for (const num of ticketMainValues) {
    if (winnerSet.has(num)) {
      matches++
    }
  }

  return { matches, hasAdditional, bonusMatched }
}

/**
 * Calculate and update carryover for a draw after winner numbers are posted
 * Also handles Superball transfer if 10 consecutive draws without Cat 1 winner
 */
export async function calculateDrawCarryover(drawDate, winnerNumbers) {
  try {
    // Get all previous draws to calculate accumulated carryover
    // Use string comparison for drawDate, matching the schema and frontend format
    const previousDraws = await WinnerNumber.find({
      drawDate: { $lt: drawDate }
    }).sort({ drawDate: -1 }).limit(1)

    let previousCarryover = 0
    let noCat1Streak = 0

    if (previousDraws.length > 0) {
      const lastDraw = previousDraws[0]
      previousCarryover = lastDraw.carryover || 0
      noCat1Streak = lastDraw.noCat1Streak || 0
    }

    // Get orders for current draw
    // Use string comparison for drawDate in orders as well
    const orders = await Order.find({
      drawDate: drawDate,
      paymentStatus: 'paid'
    })

    const totalSold = orders.reduce((sum, order) => sum + order.total, 0)
    const commission = totalSold * 0.35
    const salesPrizePool = totalSold * 0.65

    // Prize pool = sales portion + previous carryover
    let prizePool = salesPrizePool + previousCarryover

    logger.info(`Draw ${new Date(drawDate).toISOString().split('T')[0]}:`)
    logger.info(`  Sales: $${totalSold.toFixed(2)}`)
    logger.info(`  Commission (35%): $${commission.toFixed(2)}`)
    logger.info(`  Sales Prize Pool (65%): $${salesPrizePool.toFixed(2)}`)
    logger.info(`  Previous Carryover: $${previousCarryover.toFixed(2)}`)
    logger.info(`  Total Prize Pool: $${prizePool.toFixed(2)}`)

    // Check for Cat 1 winners and calculate distributed prizes
    let hasCat1Winner = false
    let distributedPrize = 0

    // Count winners per category
    const winnersByCategory = {}
    for (const category in PRIZE_CATEGORIES) {
      winnersByCategory[category] = []
    }

    for (const order of orders) {
      for (const ticket of order.tickets) {
        const { matches, bonusMatched } = calculateMatches(
          ticket.selections,
          winnerNumbers
        )

        // Categorize this ticket
        for (const category in PRIZE_CATEGORIES) {
          const cat = PRIZE_CATEGORIES[category]
          
          if (category === '8') {
            // Cat 8: 0 main matches AND FR matches
            if (matches === 0 && bonusMatched) {
              winnersByCategory[category].push({ matches, bonusMatched })
            }
          } else if (matches === cat.matches) {
            winnersByCategory[category].push({ matches, bonusMatched })
            if (category === '1') {
              hasCat1Winner = true
            }
          }
        }
      }
    }

    // Calculate distributed prizes (skip lower categories if Cat 1 has winners)
    for (const category in PRIZE_CATEGORIES) {
      if (hasCat1Winner && category > 1) continue

      const catWinners = winnersByCategory[category]
      if (catWinners.length === 0) continue

      const cat = PRIZE_CATEGORIES[category]
      const basePrize = prizePool * cat.percentage
      
      // Distribute base prize among winners
      distributedPrize += basePrize

      // Add bonus for Cat 1-7 if they have FR match
      if (category !== '8') {
        const winnersWithBonus = catWinners.filter(w => w.bonusMatched).length
        if (winnersWithBonus > 0) {
          distributedPrize += (prizePool * BONUS_PERCENTAGE)
        }
      }

      logger.info(`  Cat ${category}: ${catWinners.length} winners, Base Prize=$${basePrize.toFixed(2)}`)
    }

    logger.info(`  Total Distributed: $${distributedPrize.toFixed(2)}`)

    // Calculate carryover
    let carryover = 0
    let superballTransfer = 0

    if (!hasCat1Winner) {
      // No Cat 1 winner: entire remaining prize pool carries over
      carryover = prizePool - distributedPrize
      noCat1Streak++

      logger.info(`  No Cat 1 winner. Distributed=$${distributedPrize.toFixed(2)}, Carryover=$${carryover.toFixed(2)}, Streak=${noCat1Streak}`)

      // Only trigger Superball when exactly 10 draws completed with no Cat 1 winner
      if (noCat1Streak === 10) {
        superballTransfer = carryover
        carryover = 0
        noCat1Streak = 0
        logger.info(`🎯 SUPERBALL TRANSFER TRIGGERED! Amount: $${superballTransfer.toFixed(2)}`)
      }
    } else {
      // Cat 1 winner found: reset streak and carryover
      carryover = 0
      noCat1Streak = 0
      logger.info(`  Cat 1 winner found! Streak reset. Distributed=$${distributedPrize.toFixed(2)}`)
    }

    // Update the draw document with carryover info
    await WinnerNumber.findOneAndUpdate(
      { drawDate: drawDate },
      {
        carryover: Number(carryover.toFixed(2)),
        superballTransfer: superballTransfer > 0 ? Number(superballTransfer.toFixed(2)) : undefined,
        noCat1Streak: noCat1Streak
      }
    )

    return {
      carryover: Number(carryover.toFixed(2)),
      superballTransfer: superballTransfer > 0 ? Number(superballTransfer.toFixed(2)) : 0,
      noCat1Streak: noCat1Streak,
      triggeredSuperball: superballTransfer > 0
    }
  } catch (error) {
    logger.error('Error calculating draw carryover:', error)
    throw error
  }
}

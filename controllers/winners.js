import express from 'express'
import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import User from '../models/user.js'
import { tokenExtractor } from '../utils/middleware.js' // For authentication

const winnersRouter = express.Router()

const PRIZE_CATEGORIES = {
  1: { matches: 7, percentage: 0.9 }, // 7 hits: 90%, +0.5% if additional hit
  2: { matches: 6, percentage: 0.2 },
  3: { matches: 5, percentage: 0.15 },
  4: { matches: 4, percentage: 0.1 },
  5: { matches: 3, percentage: 0.08 },
  6: { matches: 2, percentage: 0.06 },
  7: { matches: 1, percentage: 0.045 },
  8: { matches: 0, percentage: 0.005 } // Only additional hit
}

const BONUS_PERCENTAGE = 0.005 // 0.5% bonus for hitting additional (FR)

// Helper: Calculate matches for a ticket (count if selected number matches any winner number)
export function calculateMatches(selections, winnerNumbers) {
  // Only unique numbers in selections (excluding FR) are counted for matches, regardless of country.
  // If a user selects the same number for multiple countries, it counts as one match if that number is in winner numbers.
  // Repeated numbers do not increase match count, but ticket is not invalid.
  const selectionNums = [];
  for (const country in selections) {
    if (country === 'FR') continue;
    selectionNums.push(Number(selections[country]));
  }
  const uniqueSelectionNums = Array.from(new Set(selectionNums));

  let matches = 0;
  let hasAdditional = Object.keys(selections).length === 8 || 'FR' in selections;
  let bonusMatched = false;
  if ('FR' in selections) {
    const ticketFR = Number(selections['FR']);
    let winnerFR;
    if (winnerNumbers instanceof Map) {
      winnerFR = winnerNumbers.get('FR');
    } else {
      winnerFR = winnerNumbers['FR'];
    }
    const winnerFRNum = Number(winnerFR);
    if (ticketFR === winnerFRNum) {
      bonusMatched = true;
    }
  }
  const allMainCountries = ['CA', 'IT', 'MX', 'NZ', 'KR', 'IE', 'UK'];
  let mainWinnerValues = [];
  if (winnerNumbers instanceof Map) {
    mainWinnerValues = allMainCountries
      .map((k) => Number(winnerNumbers.get(k)))
      .filter((v) => !isNaN(v));
  } else {
    mainWinnerValues = allMainCountries
      .map((k) => Number(winnerNumbers[k]))
      .filter((v) => !isNaN(v));
  }
  const winnerNums = new Set(mainWinnerValues.map(Number));
  for (const num of uniqueSelectionNums) {
    if (winnerNums.has(num)) {
      matches++;
    }
  }
  return { matches, hasAdditional, bonusMatched };
}

// // Helper: Get winners by category
// function getWinnersByCategory(ticketResults, categories) {
//   const winnersByCategory = {}
//   for (const category in categories) {
//     winnersByCategory[category] = ticketResults.filter((ticket) => {
//       const cat = categories[category]
//       return ticket.matches === cat.matches
//     })
//   }
//   return winnersByCategory
// }

// GET /api/rewards/prize-pool/:drawDate - Get real-time prize pool and carryover for a draw
winnersRouter.get('/prize-pool/:drawDate', async (req, res) => {
  let { drawDate } = req.params;
  // Remove quotes if present and normalize separator
  drawDate = drawDate.replace(/^"|"$/g, '').replace(/%20/g, ' ');
  // If ISO format (e.g. 2025-10-16T20:00:00.000Z), convert to local formatted string
  const { DateTime } = await import('luxon');
  let normalizedDrawDate = drawDate;
  if (drawDate.match(/T/)) {
    const dt = DateTime.fromISO(drawDate, { zone: 'America/Mexico_City' });
    if (dt.isValid) {
      normalizedDrawDate = dt.toFormat('yyyy-MM-dd HH:mm:ss');
    }
  }
  const { currentOnly } = req.query;
  if (!drawDate) {
    return res.status(400).json({ message: 'Missing drawDate.' });
  }
  try {
    // Use Luxon to parse and match drawDate as 'yyyy-MM-dd HH:mm:ss' in local time
    const { DateTime } = await import('luxon');
    const inputDate = DateTime.fromFormat(normalizedDrawDate, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' });
    const start = inputDate.startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
    const end = inputDate.endOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

    // Fetch paid orders for this draw (exact match)
    const orders = await Order.find({
      drawDate: normalizedDrawDate,
      paymentStatus: 'paid'
    });
    const totalSold = orders.reduce((sum, order) => sum + order.total, 0);

    if (currentOnly === 'true') {
      // Only show current week's prize pool (no carryover)
      const prizePool = Number((totalSold * 0.65).toFixed(2));
      return res.status(200).json({
        prizePool,
        totalSold: Number(totalSold.toFixed(2))
      });
    }

    // Default: include carryover logic as before
    const winnerData = await WinnerNumber.findOne({
      drawDate: normalizedDrawDate
    });

    let carryover = 0;
    if (winnerData && typeof winnerData.carryover !== 'undefined') {
      carryover = winnerData.carryover;
    } else if (!winnerData || (winnerData && typeof winnerData.carryover === 'undefined')) {
      // Accumulate carryover from all previous draws with no category 1 winners
      let prevDraw = await WinnerNumber.findOne({
        drawDate: { $lt: start }
      }).sort({ drawDate: -1 });
      let accumulated = 0;
      while (prevDraw) {
        const prevOrders = await Order.find({
          drawDate: prevDraw.drawDate,
          paymentStatus: 'paid'
        });
        let prevTotalSold = prevOrders.reduce((sum, order) => sum + order.total, 0);
        let prevHasWinners = false;
        for (const order of prevOrders) {
          for (const ticket of order.tickets) {
            const { matches } = calculateMatches(ticket.selections, prevDraw.winnerNumbers);
            if (matches === 7) {
              prevHasWinners = true;
            }
          }
        }
        if (!prevHasWinners) {
          accumulated += prevTotalSold * 0.65;
          prevDraw = await WinnerNumber.findOne({
            drawDate: { $lt: prevDraw.drawDate }
          }).sort({ drawDate: -1 });
        } else {
          accumulated += prevDraw.carryover || 0;
          break;
        }
      }
      carryover = accumulated;
    }

    let prizePool = totalSold * 0.65 + carryover; // 35% commission
    prizePool = Number(prizePool.toFixed(2));
    const divided = Number(prizePool.toFixed(2));
    const undivided = Number(prizePool.toFixed(2));
    const maxSingleWinner = undivided;
    carryover = Number(carryover.toFixed(2));
    res.status(200).json({
      prizePool: {
        divided,
        undivided
      },
      maxSingleWinner,
      carryover,
      totalSold: Number(totalSold.toFixed(2))
    });
  } catch (error) {
    console.error('Error getting prize pool:', error);
    res.status(500).json({ message: 'Error getting prize pool.', error: error.message });
  }
});

// GET /api/rewards/current-prize-pool - Get current prize pool for next draw (frontend display)
winnersRouter.get('/current-prize-pool', async (req, res) => {
  try {
    // Get the most recent draw to determine next draw date
    const latestDraw = await WinnerNumber.findOne().sort({ drawDate: -1 })
    
    let nextDrawDate
    const { DateTime } = await import('luxon');
    if (latestDraw) {
      // Next draw is 7 days after the latest
      nextDrawDate = DateTime.fromFormat(latestDraw.drawDate, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' }).plus({ days: 7 }).toFormat('yyyy-MM-dd HH:mm:ss')
    } else {
      // No draws yet, use today at 20:00:00
      nextDrawDate = DateTime.now().setZone('America/Mexico_City').set({ hour: 20, minute: 0, second: 0, millisecond: 0 }).toFormat('yyyy-MM-dd HH:mm:ss')
    }

    // Calculate accumulated carryover from all previous draws with no Cat 1 winners
    let carryover = 0
    let prevDraw = await WinnerNumber.findOne().sort({ drawDate: -1 })
    
    while (prevDraw) {
      const prevOrders = await Order.find({
        drawDate: prevDraw.drawDate,
        paymentStatus: 'paid'
      })
      
      let prevTotalSold = prevOrders.reduce((sum, order) => sum + order.total, 0)
      let prevHasWinners = false
      
      // Check if previous draw had Cat 1 winners
      for (const order of prevOrders) {
        for (const ticket of order.tickets) {
          const { matches } = calculateMatches(ticket.selections, prevDraw.winnerNumbers)
          if (matches === 7) {
            prevHasWinners = true
            break
          }
        }
        if (prevHasWinners) break
      }
      
      if (!prevHasWinners) {
        carryover += prevTotalSold * 0.65
        // Continue checking further back
        prevDraw = await WinnerNumber.findOne({
          drawDate: { $lt: prevDraw.drawDate }
        }).sort({ drawDate: -1 })
      } else {
        // Found a draw with Cat 1 winner, add its carryover and stop
        carryover += prevDraw.carryover || 0
        break
      }
    }

    // Get current sales for next draw
    const currentOrders = await Order.find({
      drawDate: nextDrawDate,
      paymentStatus: 'paid'
    })
    const totalSold = currentOrders.reduce((sum, order) => sum + order.total, 0)
    
    // Calculate prize pool
    let prizePool = totalSold * 0.65 + carryover
    
    // Round to 2 decimals
    prizePool = Number(prizePool.toFixed(2))
    carryover = Number(carryover.toFixed(2))
    const totalSoldRounded = Number(totalSold.toFixed(2))
    
    // Ensure minimum prize pool of 10
    const displayPrizePool = Math.max(prizePool, 10)
    
    res.status(200).json({
      prizePool: {
        divided: Number(displayPrizePool.toFixed(2)),
        undivided: Number(displayPrizePool.toFixed(2))
      },
      maxSingleWinner: Number(displayPrizePool.toFixed(2)),
      carryover: carryover,
      totalSold: totalSoldRounded,
  nextDrawDate: nextDrawDate
    })
  } catch (error) {
    console.error('Error getting current prize pool:', error)
    res.status(500).json({ 
      message: 'Error getting current prize pool.', 
      error: error.message 
    })
  }
})

// GET /api/rewards/history - Returns all draws with winners, prize pool, carryover, and real prize calculation
winnersRouter.get('/history', async (req, res) => {
  try {
    const draws = await WinnerNumber.find({}).sort({ drawDate: 1 })
    const history = []
    // Batch fetch all users once and map by ID for fast lookup
    const allUsers = await User.find({}, { _id: 1, username: 1, email: 1 })
    const userMap = new Map()
    const emailMap = new Map()
    allUsers.forEach((u) => {
      userMap.set(String(u._id), u.username)
      emailMap.set(String(u._id), u.email)
    })

    // Track consecutive draws with no Category 1 winner
    let noCat1Streak = 0
    let superballCarryover = 0
    for (const draw of draws) {
      const { drawDate, winnerNumbers, carryover: prevCarryover } = draw
      const orders = await Order.find({ drawDate, paymentStatus: 'paid' })
      let basePrizePool =
        orders.reduce((sum, order) => sum + order.total, 0) * 0.65 +
        (prevCarryover || 0)
      basePrizePool = Number(basePrizePool.toFixed(2))
      // Gather all tickets and calculate matches
      const ticketResults = []
      for (const order of orders) {
        for (const ticket of order.tickets) {
          const { matches, hasAdditional, bonusMatched } = calculateMatches(
            ticket.selections,
            winnerNumbers
          )
          ticketResults.push({
            orderId: order._id,
            userId: order.user,
            ticketId: ticket._id,
            selections: ticket.selections,
            matches,
            hasAdditional,
            bonusMatched
          })
        }
      }
      // Get winners by category
      const winnersByCategory = {}
      for (const category in PRIZE_CATEGORIES) {
        const cat = PRIZE_CATEGORIES[category]
        if (category === '8') {
          // Cat 8: 0 main matches AND bonusMatched (FR matches)
          winnersByCategory[category] = ticketResults.filter(
            (t) => t.matches === cat.matches && t.bonusMatched
          )
        } else {
          winnersByCategory[category] = ticketResults.filter(
            (t) => t.matches === cat.matches
          )
        }
      }
      // Distribute prizes (skip lower categories if Category 1 has winners)
      const hasCategory1Winners = winnersByCategory[1].length > 0
      const winners = []
      let distributedPrize = 0
      for (const category in PRIZE_CATEGORIES) {
        if (hasCategory1Winners && category > 1) continue
        const catWinners = winnersByCategory[category]
        if (catWinners.length === 0) continue
        const cat = PRIZE_CATEGORIES[category]
        const basePrize = basePrizePool * cat.percentage
        let totalPrizePerWinner = basePrize / catWinners.length
        for (const winner of catWinners) {
          let prize = totalPrizePerWinner
          // Add bonus for categories 1-7 if FR matches (bonusMatched)
          if (category != 8 && winner.bonusMatched) {
            prize += (basePrizePool * BONUS_PERCENTAGE) / catWinners.length
          }
          prize = Number(prize.toFixed(2))
          distributedPrize += prize
          const username = userMap.get(String(winner.userId)) || winner.userId
          const email = emailMap.get(String(winner.userId)) || null
          winners.push({
            user: username,
            email,
            ticketId: winner.ticketId,
            selections: winner.selections,
            category,
            prize,
            matches: winner.matches,
            hasAdditional: winner.hasAdditional,
            bonusMatched: winner.bonusMatched
          })
        }
      }
      // Calculate new carryover: only if no Category 1 winner, and subtract all payouts
      let carryover = 0
      if (!hasCategory1Winners) {
        carryover = Number((basePrizePool - distributedPrize).toFixed(2))
        noCat1Streak++
        // If 10 consecutive draws with no Cat1, send to Superball
        if (noCat1Streak === 10) {
          superballCarryover += carryover
          carryover = 0 // Reset carryover for main draw
          noCat1Streak = 0 // Reset streak
        }
      } else {
        carryover = 0
        noCat1Streak = 0
      }
      history.push({
        drawDate,
        winnerNumbers,
        carryover,
        prizePool: basePrizePool,
        winners,
        superballCarryover:
          superballCarryover > 0 ? superballCarryover : undefined
      })
    }
    // Removed debug log
    res.json({ history })
  } catch (error) {
    console.error('Error fetching draw history:', error)
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: 'Error fetching draw history', error: error.message })
    }
  }
})

// GET /api/rewards/current - Returns the most recent draw with winners, prize pool, carryover, and real prize calculation
winnersRouter.get('/current', async (req, res) => {
  try {
    const draw = await WinnerNumber.findOne({}).sort({ drawDate: -1 })
    if (!draw) {
      return res.status(404).json({ message: 'No draws found' })
    }
    const { drawDate, winnerNumbers, carryover } = draw
    const orders = await Order.find({ drawDate, paymentStatus: 'paid' })
    let prizePool =
      orders.reduce((sum, order) => sum + order.total, 0) * 0.65 +
      (carryover || 0)
    prizePool = Number(prizePool.toFixed(2))
    // Batch fetch all users once and map by ID for fast lookup
    const allUsers = await User.find({}, { _id: 1, username: 1, email: 1 })
    const userMap = new Map()
    const emailMap = new Map()
    allUsers.forEach((u) => {
      userMap.set(String(u._id), u.username)
      emailMap.set(String(u._id), u.email)
    })
    // Gather all tickets and calculate matches (same as /history)
    const ticketResults = []
    for (const order of orders) {
      for (const ticket of order.tickets) {
        const { matches, hasAdditional, bonusMatched } = calculateMatches(
          ticket.selections,
          winnerNumbers
        )
        ticketResults.push({
          orderId: order._id,
          userId: order.user,
          ticketId: ticket._id,
          selections: ticket.selections,
          matches,
          hasAdditional,
          bonusMatched
        })
      }
    }
    // Get winners by category (same as /history)
    const winnersByCategory = {}
    for (const category in PRIZE_CATEGORIES) {
      const cat = PRIZE_CATEGORIES[category]
      winnersByCategory[category] = ticketResults.filter(
        (t) => t.matches === cat.matches
      )
    }
    // Distribute prizes (skip lower categories if Category 1 has winners)
    const hasCategory1Winners = winnersByCategory[1].length > 0
    const winners = []
    let distributedPrize = 0
    for (const category in PRIZE_CATEGORIES) {
      if (hasCategory1Winners && category > 1) continue
      const catWinners = winnersByCategory[category]
      if (catWinners.length === 0) continue
      const cat = PRIZE_CATEGORIES[category]
      const basePrize = prizePool * cat.percentage
      let totalPrizePerWinner = basePrize / catWinners.length
      for (const winner of catWinners) {
        let prize = totalPrizePerWinner
        if (category != 1 && category != 8 && winner.hasAdditional) {
          prize += (prizePool * BONUS_PERCENTAGE) / catWinners.length
        }
        prize = Number(prize.toFixed(2))
        distributedPrize += prize
        // Use userMap and emailMap for fast lookup
        const username = userMap.get(String(winner.userId)) || winner.userId
        const email = emailMap.get(String(winner.userId)) || null
        winners.push({
          user: username,
          email,
          ticketId: winner.ticketId,
          selections: winner.selections,
          category,
          prize,
          matches: winner.matches,
          hasAdditional: winner.hasAdditional,
          bonusMatched: winner.bonusMatched
        })
      }
    }
    // Return as array for consistency with /history
    res.json({
      history: [
        {
          drawDate,
          winnerNumbers,
          carryover,
          prizePool,
          winners
        }
      ]
    })
  } catch (error) {
    console.error('Error fetching current draw:', error)
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: 'Error fetching current draw', error: error.message })
    }
  }
})

// GET /api/rewards/superball-carryover - Returns the current Superball carryover amount
winnersRouter.get('/superball-carryover', async (req, res) => {
  try {
    const draws = await WinnerNumber.find({}).sort({ drawDate: 1 })
    let carryovers = [];
    for (let i = 0; i < 10 && i < draws.length; i++) {
      const draw = draws[i];
      const { drawDate, winnerNumbers, carryover: prevCarryover } = draw;
      const orders = await Order.find({ drawDate, paymentStatus: 'paid' });
      let basePrizePool =
        orders.reduce((sum, order) => sum + order.total, 0) * 0.65 +
        (prevCarryover || 0);
      // Gather all tickets and calculate matches
      const ticketResults = [];
      for (const order of orders) {
        for (const ticket of order.tickets) {
          const { matches } = calculateMatches(ticket.selections, winnerNumbers);
          ticketResults.push({ matches });
        }
      }
      // Get winners by category
      const cat1Winners = ticketResults.filter((t) => t.matches === 7);
      const hasCategory1Winners = cat1Winners.length > 0;
      let distributedPrize = 0;
      if (!hasCategory1Winners) {
        // Calculate distributedPrize for all lower categories
        const PRIZE_CATEGORIES = {
          1: { matches: 7, percentage: 0.9 },
          2: { matches: 6, percentage: 0.2 },
          3: { matches: 5, percentage: 0.15 },
          4: { matches: 4, percentage: 0.1 },
          5: { matches: 3, percentage: 0.08 },
          6: { matches: 2, percentage: 0.06 },
          7: { matches: 1, percentage: 0.04 },
          8: { matches: 0, percentage: 0.005 }
        };
        for (const category in PRIZE_CATEGORIES) {
          if (category == 1) continue;
          const cat = PRIZE_CATEGORIES[category];
          const catWinners = ticketResults.filter(
            (t) => t.matches === cat.matches
          );
          if (catWinners.length === 0) continue;
          const basePrize = basePrizePool * cat.percentage;
          distributedPrize += basePrize;
        }
        let carryover = basePrizePool - distributedPrize;
        carryovers.push(carryover);
      } else {
        carryovers.push(0);
      }
    }
    let superballCarryover = carryovers.reduce((a, b) => a + b, 0);
    superballCarryover = Number(superballCarryover.toFixed(2));
    res.json({ superballCarryover });
  } catch (error) {
    console.error('Error fetching superball carryover:', error)
    res.status(500).json({
      message: 'Error fetching superball carryover',
      error: error.message
    })
  }
})

// GET /api/rewards/my-wins - Returns all winning tickets and prizes for the authenticated user
winnersRouter.get('/my-wins', tokenExtractor, async (req, res) => {
  try {
    const userId = (req.user && (req.user.id || req.user._id)) || req.userId || req.user;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const draws = await WinnerNumber.find({}).sort({ drawDate: 1 });
    const allWins = [];
    for (const draw of draws) {
      const { drawDate, winnerNumbers, carryover } = draw;
      const orders = await Order.find({ drawDate, paymentStatus: 'paid' });
      let basePrizePool = orders.reduce((sum, order) => sum + order.total, 0) * 0.65 + (carryover || 0);
      basePrizePool = Number(basePrizePool.toFixed(2));
      // Gather all tickets and calculate matches
      const ticketResults = [];
      for (const order of orders) {
        for (const ticket of order.tickets) {
          const { matches, hasAdditional, bonusMatched } = calculateMatches(ticket.selections, winnerNumbers);
          ticketResults.push({
            orderId: order._id,
            userId: order.user,
            ticketId: ticket.id || ticket._id,
            selections: ticket.selections,
            matches,
            hasAdditional,
            bonusMatched
          });
        }
      }
      // Get winners by category
      const winnersByCategory = {};
      for (const category in PRIZE_CATEGORIES) {
        const cat = PRIZE_CATEGORIES[category];
        if (category === '8') {
          winnersByCategory[category] = ticketResults.filter((t) => t.matches === cat.matches && t.bonusMatched);
        } else {
          winnersByCategory[category] = ticketResults.filter((t) => t.matches === cat.matches);
        }
      }
      // Distribute prizes (skip lower categories if Category 1 has winners)
      const hasCategory1Winners = winnersByCategory[1].length > 0;
      for (const category in PRIZE_CATEGORIES) {
        if (hasCategory1Winners && category > 1) continue;
        const catWinners = winnersByCategory[category];
        if (catWinners.length === 0) continue;
        const cat = PRIZE_CATEGORIES[category];
        const basePrize = basePrizePool * cat.percentage;
        let totalPrizePerWinner = basePrize / catWinners.length;
        for (const winner of catWinners) {
          if (String(winner.userId) !== String(userId)) continue;
          let prize = totalPrizePerWinner;
          if (category != 8 && winner.bonusMatched) {
            prize += (basePrizePool * BONUS_PERCENTAGE) / catWinners.length;
          }
          prize = Number(prize.toFixed(2));
          allWins.push({
            drawDate,
            ticketId: winner.ticketId,
            selections: winner.selections,
            category,
            prize,
            matches: winner.matches,
            hasAdditional: winner.hasAdditional,
            bonusMatched: winner.bonusMatched
          });
        }
      }
    }
    res.json({ wins: allWins });
  } catch (error) {
    console.error('Error fetching user wins:', error);
    res.status(500).json({ message: 'Error fetching user wins', error: error.message });
  }
});

export default winnersRouter

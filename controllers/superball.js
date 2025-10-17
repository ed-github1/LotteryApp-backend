import express from 'express'
import SuperballOrder from '../models/superballOrder.js'
import SuperballWinner from '../models/superballWinner.js'
import User from '../models/user.js'
import { tokenExtractor } from '../utils/middleware.js'
import { getNextDrawDateForCountry } from './drawSchedule.js'
import { awardSuperballWinners, getCurrentSuperballJackpot } from '../utils/awardSuperballWinners.js'
import { getIO } from '../utils/socket.js' // Assumes you have a getIO() util to access io

const superballRouter = express.Router()

// POST /api/superball/enter - Enter Superball draw with credits
superballRouter.post('/enter', tokenExtractor, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const tickets = req.body.tickets
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ message: 'No tickets provided' })
    }


    const creditsNeeded = tickets.length * 10
    if (user.credits < creditsNeeded) {
      return res
        .status(400)
        .json({
          message: `Not enough credits. You need ${creditsNeeded} credits to enter ${tickets.length} Superball tickets.`
        })
    }

    // Deduct credits
    user.credits -= creditsNeeded
    await user.save()

    // Get next Superball draw date
    const drawDate = getNextDrawDateForCountry('SUPERBALL')
    if (!drawDate) {
      return res
        .status(500)
        .json({ message: 'Draw date for SUPERBALL is not configured.' })
    }

    // Prepare tickets array
    const ticketsToSave = tickets.map((ticket) => ({
      numbers: ticket.numbers,
      drawDate: drawDate
    }))

    // Create one Superball order with all tickets
    const order = new SuperballOrder({
      user: req.userId,
      tickets: ticketsToSave
    })
    await order.save()

    res
      .status(201)
      .json({ message: 'Successfully entered Superball draw!', order })
  } catch (error) {
    console.error('Error entering Superball draw:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/entries - Get user's Superball orders (all tickets)
superballRouter.get('/entries', tokenExtractor, async (req, res) => {
  try {
    const orders = await SuperballOrder.find({ user: req.userId }).sort({ createdAt: -1 })
    // Flatten all tickets for this user
    const entries = orders.flatMap(order =>
      order.tickets.map(ticket => ({
        orderId: order._id,
        numbers: ticket.numbers,
        drawDate: ticket.drawDate,
        createdAt: order.createdAt
      }))
    )
    res.json(entries)
  } catch (error) {
    console.error('Error fetching Superball entries:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/orders - Get all Superball orders (no auth yet)
superballRouter.get('/orders', tokenExtractor, async (req, res) => {
  try {
    const orders = await SuperballOrder.find()
      .populate('user')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    console.error('Error fetching Superball orders:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/jackpot - Get current Superball jackpot
superballRouter.get('/jackpot', async (req, res) => {
  try {
    const jackpot = await getCurrentSuperballJackpot()
    if (!jackpot) {
      return res.json({
        active: false,
        amount: 0,
        message: 'No active Superball jackpot'
      })
    }
    // Optionally emit jackpot update (if you want to broadcast every fetch)
    // getIO().emit('superballJackpotUpdate', { amount: jackpot.amount })
    res.json({
      active: true,
      amount: jackpot.amount,
      triggeredDate: jackpot.triggeredDate,
      message: `Superball jackpot active: $${jackpot.amount.toFixed(2)}`
    })
  } catch (error) {
    console.error('Error fetching Superball jackpot:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/superball/draw-winner - Post Superball winner number and award jackpot
superballRouter.post('/draw-winner', async (req, res) => {
  try {
    const { drawDate, winnerNumber } = req.body

    if (!drawDate || winnerNumber == null) {
      return res.status(400).json({ message: 'drawDate and winnerNumber are required' })
    }

    // Validate winner number (1-10)
    if (typeof winnerNumber !== 'number' || winnerNumber < 1 || winnerNumber > 10) {
      return res.status(400).json({ message: 'winnerNumber must be a number between 1 and 10' })
    }

    // Get the active Superball jackpot
    const jackpot = await getCurrentSuperballJackpot()
    
    if (!jackpot) {
      return res.status(400).json({ 
        message: 'No active Superball jackpot to award. Regular lottery must trigger Superball first (10 consecutive draws without Cat 1 winner).' 
      })
    }

    // Award winners
    const result = await awardSuperballWinners(
      new Date(drawDate),
      winnerNumber,
      jackpot.amount
    )

    // Emit superballDeactivated event (jackpot awarded)
    getIO().emit('superballDeactivated');

    res.status(201).json({
      message: 'Superball winners notified successfully! USDT will be deposited within 48 hours.',
      drawDate,
      winnerNumber,
      totalWinners: result.totalWinners,
      prizePerWinner: result.prizePerWinner,
      jackpotAmount: result.jackpotAmount,
      depositStatus: 'Pending (within 48 hours)',
      winners: result.winners
    })
  } catch (error) {
    console.error('Error awarding Superball winners:', error)
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Superball winner numbers already posted for this draw date' 
      })
    }
    
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/my-wins - Get logged-in user's Superball wins
superballRouter.get('/my-wins', tokenExtractor, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Find all draws where this user won
    const allWinnerDraws = await SuperballWinner.find().sort({ drawDate: -1 })
    
    const userWins = []
    for (const draw of allWinnerDraws) {
      const userWinnersInDraw = draw.winners.filter(
        (winner) => winner.email === user.email
      )
      
      if (userWinnersInDraw.length > 0) {
        userWins.push({
          drawDate: draw.drawDate,
          winnerNumber: draw.winnerNumber,
          jackpotAmount: draw.jackpotAmount,
          totalWinners: draw.totalWinners,
          prizePerWinner: draw.prizePerWinner,
          myWinnings: userWinnersInDraw.map(w => ({
            ticket: w.ticket,
            prize: w.prize,
            depositPending: w.depositPending,
            depositedAt: w.depositedAt,
            notified: w.notified
          }))
        })
      }
    }
    
    res.json({
      hasWins: userWins.length > 0,
      totalWins: userWins.length,
      wins: userWins
    })
  } catch (error) {
    console.error('Error fetching user Superball wins:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/winners - Get all Superball winner results
superballRouter.get('/winners', async (req, res) => {
  try {
    const winners = await SuperballWinner.find().sort({ drawDate: -1 })
    res.json(winners)
  } catch (error) {
    console.error('Error fetching Superball winners:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/superball/winners/:drawDate - Get Superball winners for specific draw
superballRouter.get('/winners/:drawDate', async (req, res) => {
  try {
    const winner = await SuperballWinner.findOne({
      drawDate: new Date(req.params.drawDate)
    })
    
    if (!winner) {
      return res.status(404).json({ message: 'No Superball winners found for this date' })
    }
    
    res.json(winner)
  } catch (error) {
    console.error('Error fetching Superball winner:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default superballRouter


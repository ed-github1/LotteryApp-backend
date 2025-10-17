import express from 'express'
import WinnerNumber from '../models/winnerNumber.js'
import { calculateDrawCarryover } from '../utils/carryover.js'
import { getNextDrawDateForCountry } from './drawSchedule.js'
import { DateTime } from 'luxon'

const winnerNumberRouter = express.Router()

// GET /api/winner-numbers/all - Get all winner numbers (admin)
winnerNumberRouter.get('/all', async (req, res) => {
  const winners = await WinnerNumber.find().sort({ drawDate: -1 })
  res.json(winners)
})

//GET /api/winner-numbers/week - Get the most recent/latest winner numbers
winnerNumberRouter.get('/week', async (req, res) => {
  try {
    //   Get the most recent draw
    const latestDraw = await WinnerNumber.findOne()
      .sort({ drawDate: -1 })
      .limit(1)

    if (!latestDraw) {
      return res.status(404).json({ message: 'No winner numbers found.' })
    }

    //Only show winner numbers if current time is between 8pm and midnight of the draw date
    const now = new Date()
    const drawDate = new Date(latestDraw.drawDate)

    // TESTING MODE: Disable time window check - show winner numbers immediately
    //PRODUCTION: Uncomment the time window logic below
    /*
    Set 8pm and midnight boundaries for the draw date (local time)
    const eightPM = new Date(drawDate);
    eightPM.setHours(20, 0, 0, 0);
    const midnight = new Date(drawDate);
    midnight.setHours(23, 59, 59, 999);
    if (now < eightPM || now > midnight) {
      return res.status(200).json({
        message: 'Waiting for next winner numbers. Please check back after 8pm on draw day.'
      });
    }
    */

    res.json({
      drawDate: latestDraw.drawDate,
      winnerNumbers: latestDraw.winnerNumbers,
      carryover: latestDraw.carryover
    })
  } catch (error) {
    console.error('Error fetching latest winner numbers:', error)
    res.status(500).json({ message: 'Error fetching winner numbers.' })
  }
})

// POST /api/winner-numbers/trigger-superball-test - Quick test endpoint to trigger Superball
winnerNumberRouter.post('/trigger-superball-test', async (req, res) => {
  try {
    // Check current status first
    const latestDraw = await WinnerNumber.findOne().sort({ drawDate: -1 })

    if (!latestDraw || latestDraw.noCat1Streak !== 9) {
      return res.status(400).json({
        message: 'Cannot trigger Superball. Current streak must be 9.',
        currentStreak: latestDraw?.noCat1Streak || 0
      })
    }

    // Post winner numbers for Oct 3, 2025 draw (draw 10)
    const drawDate = new Date('2025-10-03T19:00:00.000Z')
    const winnerNumbers = {
      IT: 10,
      CA: 20,
      MX: 30,
      NZ: 40,
      KR: 50,
      IE: 15,
      UK: 25,
      FR: 5
    }

    // Check if already posted
    const existing = await WinnerNumber.findOne({ drawDate })
    if (existing) {
      return res.status(400).json({
        message: 'Winner numbers already posted for this draw',
        existingDraw: existing
      })
    }

    // Create winner number document
    const winnerDoc = await WinnerNumber.create({
      drawDate,
      winnerNumbers
    })

    // Calculate carryover (this will trigger Superball!)
    const carryoverResult = await calculateDrawCarryover(
      drawDate,
      winnerNumbers
    )

    // Emit socket event if Superball was triggered
    if (carryoverResult.triggeredSuperball) {
      const { getIO } = await import('../utils/socket.js')
      getIO().emit('superballActivated', {
        amount: carryoverResult.superballTransfer,
        triggeredDate: drawDate
      })
    }

    res.status(201).json({
      message: carryoverResult.triggeredSuperball
        ? '🎯 SUPERBALL TRIGGERED!'
        : 'Winner numbers posted',
      drawDate,
      winnerNumbers,
      carryover: carryoverResult.carryover,
      noCat1Streak: carryoverResult.noCat1Streak,
      superballTransfer: carryoverResult.superballTransfer,
      triggeredSuperball: carryoverResult.triggeredSuperball
    })
  } catch (error) {
    console.error('Error triggering Superball:', error)
    res.status(500).json({ message: 'Error triggering Superball' })
  }
})

// POST /api/winner-numbers - Create winner numbers for a new draw
winnerNumberRouter.post('/', async (req, res) => {
  try {
    let { drawDate, winnerNumbers } = req.body

    // If drawDate is not provided, use current draw date in correct format
    if (!drawDate) {
      let detected = getNextDrawDateForCountry('IT', new Date())
      let dt
      if (typeof detected === 'string') {
        dt = DateTime.fromISO(detected, { zone: 'America/Mexico_City' })
      } else {
        dt = DateTime.fromJSDate(detected, { zone: 'America/Mexico_City' })
      }
      drawDate = dt.toFormat('yyyy-MM-dd HH:mm:ss')
    }

    // Check if already posted for this drawDate string
    const existing = await WinnerNumber.findOne({ drawDate })
    if (existing) {
      return res.status(200).json({
        message: 'Winner numbers for this drawDate already exist.',
        winner: existing
      })
    }

    // Create the winner number document
    const newDoc = await WinnerNumber.create({ drawDate, winnerNumbers })

    // Calculate carryover and check for Superball transfer
    const carryoverResult = await calculateDrawCarryover(
      drawDate,
      winnerNumbers
    )

    // Emit socket event if Superball was triggered
    if (carryoverResult.triggeredSuperball) {
      const { getIO } = await import('../utils/socket.js')
      getIO().emit('superballActivated', {
        amount: carryoverResult.superballTransfer,
        triggeredDate: drawDate
      })
    }

    // Return the document with carryover info
    const updatedDoc = await WinnerNumber.findById(newDoc._id)

    return res.status(201).json({
      ...updatedDoc.toJSON(),
      superballTransfer: carryoverResult.superballTransfer,
      noCat1Streak: carryoverResult.noCat1Streak,
      triggeredSuperball: carryoverResult.triggeredSuperball
    })
  } catch (error) {
    console.error('Error creating winner numbers:', error)
    return res.status(500).json({
      message: 'Error creating winner numbers',
      error: error.message
    })
  }
})

// PATCH /api/winner-numbers/:id - Update/add a country's winner number for an existing draw
winnerNumberRouter.patch('/:id', async (req, res) => {
  const { countryCode, winnerNumber } = req.body
  if (!countryCode || winnerNumber == null) {
    return res.status(400).json({ message: 'Missing required fields.' })
  }
  const winner = await WinnerNumber.findById(req.params.id)
  if (!winner) return res.status(404).json({ message: 'Draw not found.' })
  winner.winnerNumbers.set
    ? winner.winnerNumbers.set(countryCode, winnerNumber)
    : (winner.winnerNumbers[countryCode] = winnerNumber)
  await winner.save()
  res.json({ message: 'Winner number updated.', winner })
})

// GET /api/winner-numbers/superball-status - Check if Superball was triggered
winnerNumberRouter.get('/superball-status', async (req, res) => {
  try {
    // Find the most recent draw with a Superball transfer
    const superballDraw = await WinnerNumber.findOne({
      superballTransfer: { $exists: true, $gt: 0 }
    }).sort({ drawDate: -1 })

    if (!superballDraw) {
      // Check current streak
      const latestDraw = await WinnerNumber.findOne().sort({ drawDate: -1 })

      return res.json({
        triggered: false,
        currentStreak: latestDraw?.noCat1Streak || 0,
        drawsUntilSuperball: Math.max(0, 10 - (latestDraw?.noCat1Streak || 0)),
        message: `${Math.max(
          0,
          10 - (latestDraw?.noCat1Streak || 0)
        )} more draw(s) needed to trigger Superball`
      })
    }

    res.json({
      triggered: true,
      amount: superballDraw.superballTransfer,
      drawDate: superballDraw.drawDate,
      message: `Superball triggered! $${superballDraw.superballTransfer.toFixed(
        2
      )} transferred to Superball jackpot`
    })
  } catch (error) {
    console.error('Error checking Superball status:', error)
    res.status(500).json({ message: 'Error checking Superball status' })
  }
})

// POST /api/winner-numbers/generate-random - Generate random winner numbers for a draw (admin/test)
winnerNumberRouter.post('/generate-random', async (req, res) => {
  try {
    const { drawDate, countries } = req.body
    if (
      !drawDate ||
      !countries ||
      !Array.isArray(countries) ||
      countries.length === 0
    ) {
      return res
        .status(400)
        .json({ message: 'drawDate and countries[] required' })
    }
    // Generate random numbers (1-59) for each country
    const winnerNumbers = {}
    countries.forEach((code) => {
      winnerNumbers[code] = Math.floor(Math.random() * 59) + 1
    })
    // Check if already exists
    const inputDate = new Date(drawDate)
    const start = new Date(inputDate)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(inputDate)
    end.setUTCHours(23, 59, 59, 999)
    const existing = await WinnerNumber.findOne({
      drawDate: { $gte: start, $lte: end }
    })
    if (existing) {
      return res.status(200).json({
        message: 'Winner numbers for this drawDate already exist.',
        winner: existing
      })
    }
    // Create the winner number document
    const newDoc = await WinnerNumber.create({ drawDate, winnerNumbers })
    // Calculate carryover and check for Superball transfer
    const carryoverResult = await calculateDrawCarryover(
      drawDate,
      winnerNumbers
    )
    // Return the document with carryover info
    const updatedDoc = await WinnerNumber.findById(newDoc._id)
    return res.status(201).json({
      ...updatedDoc.toJSON(),
      superballTransfer: carryoverResult.superballTransfer,
      noCat1Streak: carryoverResult.noCat1Streak,
      triggeredSuperball: carryoverResult.triggeredSuperball
    })
  } catch (error) {
    console.error('Error generating random winner numbers:', error)
    return res.status(500).json({
      message: 'Error generating random winner numbers',
      error: error.message
    })
  }
})

export default winnerNumberRouter

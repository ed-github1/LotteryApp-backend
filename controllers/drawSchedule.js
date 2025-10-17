import express from 'express'
import { DateTime } from 'luxon'

const drawSchedulesRouter = express.Router()

// TESTING ONLY: Daily draws for all countries at 2:00 UTC (8pm Central Time UTC-6)
// For daily testing, set 'daily: true' to ignore weekday and draw every day



const countryDrawSchedules = {
  SUPERBALL: { daily: true, hour: 19, minute: 0 },
  IT: { daily: true, hour: 19, minute: 0 },
  CA: { daily: true, hour: 19, minute: 0 },
  MX: { daily: true, hour: 19, minute: 0 },
  NZ: { daily: true, hour: 19, minute: 0 },
  KR: { daily: true, hour: 19, minute: 0 },
  IE: { daily: true, hour: 19, minute: 0 },
  UK: { daily: true, hour: 19, minute: 0 },
  FR: { daily: true, hour: 19, minute: 0 }
}

/*
// REAL SCHEDULE (uncomment for production)
const countryDrawSchedules = {
  SUPERBALL: { day: 3, hour: 20, minute: 30 }, // Wednesday 20:30 GMT
  IT: { day: 5, hour: 19, minute: 0 }, //  Friday 19:00 GMT
  CA: { day: 6, hour: 2, minute: 0 }, // friday 02:00 GMT
  MX: { day: 5, hour: 21, minute: 15 }, // friday 21:15  GMT
  NZ: { day: 6, hour: 8, minute: 0 }, // Saturday 08:00  GMT
  KR: { day: 6, hour: 11, minute: 40 }, //  Saturday: 11:40  GMT
  IE: { day: 6, hour: 18, minute: 55 }, // Saturday 18:55  GMT
  UK: { day: 6, hour: 20, minute: 0 }, // Saturday 20:55  GMT
  FR: { day: 7, hour: 0, minute: 35 } //Sunday 00:35 GMT
}
*/

export function getNextDrawDateForCountry(
  countryCode,
  now = new Date(),
  gracePeriodMinutes = 15
) {
  // Use 8:00 PM America/Mexico_City as the local draw time for daily draws
  const localZone = 'America/Mexico_City'
  const schedule = countryDrawSchedules[countryCode]
  if (!schedule) throw new Error('Unknown country code')

  // Get current time in local zone
  let localNow = DateTime.fromJSDate(now, { zone: localZone })
  // Draw is always at schedule.hour local time
  let drawLocal = localNow.set({ hour: schedule.hour, minute: schedule.minute, second: 0, millisecond: 0 })

  // If now is before draw time, today's draw; if after or equal, tomorrow's draw
  if (localNow < drawLocal) {
    // today at draw time
  } else {
    drawLocal = drawLocal.plus({ days: 1 })
  }

  // For expireTickets.js, return a JS Date (for getTime()), else return ISO string
  // If called from expireTickets.js, expect to need a Date object
  // If now is a string, parse as Date
  if (typeof now === 'string' || now instanceof String) {
    now = new Date(now)
  }
  // If caller expects a Date, return Date
  if (process.env.RETURN_DRAWDATE_AS_DATE === 'true') {
    return new Date(drawLocal.toISO())
  }
  // Default: return ISO string with offset
  return drawLocal.toISO()
}

// Get next draw date for each country, ordered by soonest
drawSchedulesRouter.get('/next-draws', (req, res) => {
  const now = new Date()
  const nextDrawsArr = []

  for (const countryCode of Object.keys(countryDrawSchedules)) {
    try {
      const nextDate = getNextDrawDateForCountry(countryCode, now)
      nextDrawsArr.push({
        countryCode,
        drawDate: nextDate.toISOString(),
        schedule: countryDrawSchedules[countryCode]
      })
    } catch (e) {
      // Optionally skip or add with null
    }
  }

  // Sort by drawDate ascending
  nextDrawsArr.sort((a, b) => new Date(a.drawDate) - new Date(b.drawDate))

  res.status(200).json(nextDrawsArr)
})

// GET /api/draw-schedules/current-draw - Get the exact current draw date for orders/winner numbers
drawSchedulesRouter.get('/current-draw', (req, res) => {
  const now = new Date()
  const drawDate = getNextDrawDateForCountry('IT', now)
  res.status(200).json({
    drawDate: drawDate.toISOString(),
    timestamp: drawDate.getTime(),
    localTime: drawDate.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }),
    message: 'Use this exact drawDate for posting orders and winner numbers'
  })
})

export default drawSchedulesRouter

import Order from '../models/order.js'
import logger from './logger.js'
import { getNextDrawDateForCountry } from '../controllers/drawSchedule.js'

/**
 * Mark orders as expired if their draw date has passed
 * This should be run after each weekly draw
 */
export async function expireOldTickets() {
  try {
    const now = new Date()
    
    // Find all non-expired orders where draw date has passed
    const result = await Order.updateMany(
      {
        drawDate: { $lt: now },
        expired: false
      },
      {
        $set: { expired: true }
      }
    )

    if (result.modifiedCount > 0) {
      logger.info(`Expired ${result.modifiedCount} old tickets after draw completion`)
    }

    return result.modifiedCount
  } catch (error) {
    logger.error('Error expiring old tickets:', error)
    throw error
  }
}

/**
 * Calculate when to run the next expiration check
 * Returns milliseconds until the next draw ends
 */
function getNextDrawEndTime() {
  const now = new Date()
  const countries = ['SUPERBALL', 'IT', 'CA', 'MX', 'NZ', 'KR', 'IE', 'UK', 'FR']
  
  let nextDrawDate = null
  
  // Find the soonest upcoming draw
  for (const country of countries) {
    try {
        process.env.RETURN_DRAWDATE_AS_DATE = 'true'
        const drawDate = getNextDrawDateForCountry(country, now, 0) // No grace period
      if (!nextDrawDate || drawDate < nextDrawDate) {
        nextDrawDate = drawDate
      }
    } catch (error) {
      logger.error(`Error getting draw date for ${country}:`, error)
    }
  }
  
  if (!nextDrawDate) {
    // Fallback: check again in 1 hour if something went wrong
    return 60 * 60 * 1000
  }
  
    // If nextDrawDate is a string, parse as Date
    let nextDrawDateObj = typeof nextDrawDate === 'string' ? new Date(nextDrawDate) : nextDrawDate
    const msUntilDraw = nextDrawDateObj.getTime() - now.getTime()
  
  // Add 5 minutes after draw time to ensure it's completed
  let nextCheckTime = msUntilDraw + (5 * 60 * 1000)
  
  // TESTING MODE FIX: Prevent rapid loops with minimum 10-minute wait
  // This avoids issues with daily draws and grace periods
  const MIN_WAIT_TIME = 10 * 60 * 1000 // 10 minutes
  if (nextCheckTime < MIN_WAIT_TIME) {
    logger.info(`Next check time too soon (${Math.round(nextCheckTime/1000/60)}min), using minimum wait of 10min`)
    nextCheckTime = MIN_WAIT_TIME
  }
  
  return nextCheckTime
}

/**
 * Start the ticket expiration job
 * Runs after each weekly draw ends
 */
export function startTicketExpirationJob() {
  logger.info('Starting ticket expiration job (runs after each weekly draw)')
  
  // Run immediately on startup to catch any old tickets
  expireOldTickets().catch(err => {
    logger.error('Initial ticket expiration failed:', err)
  })
  
  // Schedule next run based on next draw time
  function scheduleNext() {
    const msUntilNextCheck = getNextDrawEndTime()
    const nextCheckDate = new Date(Date.now() + msUntilNextCheck)
    
    logger.info(`Next ticket expiration check scheduled for: ${nextCheckDate.toISOString()}`)
    
    setTimeout(() => {
      expireOldTickets()
        .then(() => {
          logger.info('Ticket expiration completed, scheduling next check')
          scheduleNext() // Schedule the next run
        })
        .catch(err => {
          logger.error('Scheduled ticket expiration failed:', err)
          scheduleNext() // Still schedule next run even if this one failed
        })
    }, msUntilNextCheck)
  }
  
  scheduleNext()
}

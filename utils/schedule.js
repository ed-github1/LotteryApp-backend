// filepath: app.js (or utils/scheduler.js)
import cron from 'node-cron'
import WinnerNumber from '../models/winnerNumber.js' // Assuming you have a Winner model

// Schedule to run every Sunday at midnight
cron.schedule('0 0 * * 0', async () => {
  try {
    console.log('Deleting old winner numbers...')
    await WinnerNumber.deleteMany({}) // Delete all winner numbers
    console.log('Winner numbers deleted successfully.')
  } catch (error) {
    console.error('Error deleting winner numbers:', error)
  }
})

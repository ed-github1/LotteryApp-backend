import mongoose from 'mongoose'
import WinnerNumber from '../models/winnerNumber.js'
import { MONGODB_URI } from '../utils/config.js'

await mongoose.connect(MONGODB_URI)

console.log('Deleting winner numbers with wrong date...')

// Delete the winner number with the wrong date
const result = await WinnerNumber.deleteOne({ 
  drawDate: new Date('2025-10-16T19:00:00.000Z') 
})

console.log(`Deleted ${result.deletedCount} winner number document(s)`)
console.log('\nNow you can manually post winner numbers from the admin panel')
console.log('Make sure to use drawDate: 2025-10-16T02:00:00.000Z')

await mongoose.connection.close()

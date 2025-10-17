import mongoose from 'mongoose'
import WinnerNumber from '../models/winnerNumber.js'
import { MONGODB_URI } from '../utils/config.js'

await mongoose.connect(MONGODB_URI)

console.log('Updating winner number drawDate...')

// Update the wrong date to the correct one
const result = await WinnerNumber.updateOne(
  { drawDate: new Date('2025-10-16T19:00:00.000Z') },
  { $set: { drawDate: new Date('2025-10-16T02:00:00.000Z') } }
)

console.log(`Updated ${result.modifiedCount} document(s)`)

// Verify
const winner = await WinnerNumber.findOne({ drawDate: new Date('2025-10-16T02:00:00.000Z') })
console.log('\n✅ Winner numbers now have correct date:')
console.log('Draw Date:', winner.drawDate.toISOString())
console.log('Winner Numbers:', winner.winnerNumbers)

await mongoose.connection.close()

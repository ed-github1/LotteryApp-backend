import mongoose from 'mongoose'
import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import { MONGODB_URI } from '../utils/config.js'

await mongoose.connect(MONGODB_URI)

console.log('=== CHECKING ORDERS vs WINNER NUMBERS ===\n')

// Get winner numbers
const winners = await WinnerNumber.find().sort({ drawDate: -1 }).limit(3)
console.log('📅 Winner Number Draw Dates:')
winners.forEach(w => {
  console.log(`  ${w.drawDate.toISOString()}`)
})

console.log('\n📦 Paid Order Draw Dates:')
const orders = await Order.find({ paymentStatus: 'paid' }).sort({ drawDate: -1 }).limit(10)
orders.forEach(o => {
  console.log(`  ${o.drawDate.toISOString()} - Order ${o._id} - ${o.tickets.length} tickets`)
})

await mongoose.connection.close()

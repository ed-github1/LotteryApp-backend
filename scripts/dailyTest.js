import mongoose from 'mongoose'
import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import User from '../models/user.js'
import { MONGODB_URI } from '../utils/config.js'
import { getNextDrawDateForCountry } from '../controllers/drawSchedule.js'

await mongoose.connect(MONGODB_URI)

console.log('\n🎯 DAILY LOTTERY TESTING HELPER\n')
console.log('=' .repeat(50))

// Get current draw date
const now = new Date()
const drawDate = getNextDrawDateForCountry('IT', now)

console.log('\n📅 CURRENT DRAW INFORMATION:')
console.log('   Draw Date (UTC):', drawDate.toISOString())
console.log('   Draw Date (Your Time):', drawDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
console.log('   Timestamp:', drawDate.getTime())

// Check existing orders for this draw
const orders = await Order.find({ 
  drawDate: drawDate,
  paymentStatus: 'paid' 
})

console.log('\n📦 PAID ORDERS:')
console.log(`   Found: ${orders.length} orders`)
let totalTickets = 0
orders.forEach(order => {
  totalTickets += order.tickets.length
  console.log(`   - Order ${order._id}: ${order.tickets.length} tickets, $${order.total}`)
})
console.log(`   Total Tickets: ${totalTickets}`)

// Check winner numbers
const winnerDoc = await WinnerNumber.findOne({ drawDate: drawDate })

console.log('\n🎯 WINNER NUMBERS:')
if (winnerDoc) {
  console.log('   Status: ✅ Posted')
  console.log('   Numbers:', Object.fromEntries(winnerDoc.winnerNumbers || {}))
  console.log('   Document ID:', winnerDoc._id)
} else {
  console.log('   Status: ❌ Not posted yet')
  console.log('\n   💡 To post winner numbers from your admin panel:')
  console.log(`   1. Use draw date: ${drawDate.toISOString()}`)
  console.log(`   2. Or in local time: ${drawDate.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`)
}

console.log('\n' + '='.repeat(50))
console.log('\n✅ WHAT TO DO NEXT:\n')

if (orders.length === 0) {
  console.log('1. Create test orders:')
  console.log(`   node createDailyTestOrders.js ${drawDate.toISOString().split('T')[0]}`)
} else {
  console.log('✅ Orders exist for this draw')
}

if (!winnerDoc) {
  console.log('\n2. Post winner numbers from admin panel')
  console.log(`   Use draw date: ${drawDate.toISOString()}`)
} else {
  console.log('\n✅ Winner numbers already posted')
}

if (orders.length > 0 && winnerDoc) {
  console.log('\n🎉 Everything ready! Check winners:')
  console.log('   GET /api/rewards/current')
}

console.log('\n')

await mongoose.connection.close()

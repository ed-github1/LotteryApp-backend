import mongoose from 'mongoose'
import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import { MONGODB_URI } from '../utils/config.js'

await mongoose.connect(MONGODB_URI)

// Helper: Calculate matches for a ticket
function calculateMatches(selections, winnerNumbers) {
  let matches = 0
  let hasAdditional = Object.keys(selections).length === 8 || 'FR' in selections
  let bonusMatched = false
  
  if ('FR' in selections) {
    const ticketFR = Number(selections['FR'])
    const winnerFR = Number(winnerNumbers['FR'])
    if (ticketFR === winnerFR) {
      bonusMatched = true
    }
  }

  // Only use main winner numbers (exclude FR)
  const allMainCountries = ['CA', 'IT', 'MX', 'NZ', 'KR', 'IE', 'UK']
  let mainWinnerValues = []
  
  // Handle both Map and plain object
  if (winnerNumbers instanceof Map) {
    mainWinnerValues = allMainCountries
      .map((k) => Number(winnerNumbers.get(k)))
      .filter((v) => !isNaN(v))
  } else {
    mainWinnerValues = allMainCountries
      .map((k) => Number(winnerNumbers[k]))
      .filter((v) => !isNaN(v))
  }

  // Count matches
  const ticketNums = new Set()
  for (const country in selections) {
    if (country === 'FR') continue
    ticketNums.add(Number(selections[country]))
  }
  
  const winnerNums = new Set(mainWinnerValues)
  
  console.log('Ticket numbers:', Array.from(ticketNums))
  console.log('Main winner values:', mainWinnerValues)
  console.log('Winner numbers set:', Array.from(winnerNums))
  
  for (const num of ticketNums) {
    if (winnerNums.has(num)) {
      matches++
      console.log(`✓ Match found: ${num}`)
    }
  }
  
  return { matches, hasAdditional, bonusMatched }
}

// Get the most recent draw
const draw = await WinnerNumber.findOne({}).sort({ drawDate: -1 })
if (!draw) {
  console.log('No draws found!')
  process.exit(0)
}

console.log('\n📅 Draw Date:', draw.drawDate)
console.log('🎯 Winner Numbers:', draw.winnerNumbers)
console.log()

// Get all paid orders for this draw
const orders = await Order.find({ 
  drawDate: draw.drawDate, 
  paymentStatus: 'paid' 
})

console.log(`📦 Found ${orders.length} paid orders for this draw\n`)

// Check each ticket
let totalTickets = 0
let winnersFound = 0

for (const order of orders) {
  console.log(`\n--- Order ${order._id} ---`)
  console.log(`User: ${order.user}`)
  console.log(`Tickets: ${order.tickets.length}`)
  
  for (const ticket of order.tickets) {
    totalTickets++
    console.log(`\n  Ticket ${ticket._id}:`)
    console.log('  Selections:', ticket.selections)
    
    const { matches, hasAdditional, bonusMatched } = calculateMatches(
      ticket.selections,
      draw.winnerNumbers
    )
    
    console.log(`  Matches: ${matches}`)
    console.log(`  Has Additional: ${hasAdditional}`)
    console.log(`  Bonus Matched: ${bonusMatched}`)
    
    if (matches > 0) {
      winnersFound++
      console.log(`  ✅ WINNER! Category: ${8 - matches + 1}`)
    }
  }
}

console.log(`\n\n📊 Summary:`)
console.log(`Total tickets: ${totalTickets}`)
console.log(`Winners found: ${winnersFound}`)

await mongoose.connection.close()

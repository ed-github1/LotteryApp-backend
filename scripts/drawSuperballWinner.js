// Usage: node drawSuperballWinner.js YYYY-MM-DD winnerNumber
// Example: node drawSuperballWinner.js 2025-10-24 5
// Posts a Superball winner number (1-10) and awards the jackpot to all matching tickets

import connectToDatabase from '../utils/db.js'
import { awardSuperballWinners, getCurrentSuperballJackpot } from '../utils/awardSuperballWinners.js'

const drawDateArg = process.argv[2]
const winnerNumberArg = process.argv[3]

if (!drawDateArg || !winnerNumberArg) {
  console.error('Usage: node drawSuperballWinner.js YYYY-MM-DD winnerNumber')
  console.error('Example: node drawSuperballWinner.js 2025-10-24 5')
  process.exit(1)
}

const drawDate = new Date(drawDateArg + 'T20:00:00Z')
const winnerNumber = parseInt(winnerNumberArg, 10)

if (isNaN(winnerNumber) || winnerNumber < 1 || winnerNumber > 10) {
  console.error('❌ Winner number must be between 1 and 10')
  process.exit(1)
}

async function main() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB')

    // Check if Superball is active
    const jackpot = await getCurrentSuperballJackpot()
    
    if (!jackpot) {
      console.error('❌ No active Superball jackpot!')
      console.error('   Regular lottery must trigger Superball first (10 consecutive draws without Cat 1 winner).')
      process.exit(1)
    }

    console.log(`\n🎯 Active Superball Jackpot: $${jackpot.amount.toFixed(2)}`)
    console.log(`   Triggered on: ${jackpot.triggeredDate.toISOString().split('T')[0]}`)
    console.log(`\n📝 Posting Superball winner number ${winnerNumber} for draw ${drawDate.toISOString().split('T')[0]}...\n`)

    // Award winners
    const result = await awardSuperballWinners(drawDate, winnerNumber, jackpot.amount)

    console.log('✅ Superball winner posted successfully!\n')
    console.log(`🎉 Results:`)
    console.log(`   Draw Date: ${drawDate.toISOString().split('T')[0]}`)
    console.log(`   Winner Number: ${winnerNumber}`)
    console.log(`   Total Winners: ${result.totalWinners}`)
    console.log(`   Jackpot Amount: $${result.jackpotAmount.toFixed(2)}`)
    console.log(`   Prize Per Winner: $${result.prizePerWinner.toFixed(2)}`)
    console.log(`\n💰 Winners will be notified and USDT will be deposited within 48 hours.\n`)

    if (result.winners && result.winners.length > 0) {
      console.log('🏆 Winning tickets:')
      result.winners.forEach((winner, i) => {
        console.log(`   ${i + 1}. ${winner.email} - Ticket: ${winner.ticket} - Prize: $${winner.prize.toFixed(2)}`)
      })
    }

    process.exit(0)
  } catch (err) {
    if (err.code === 11000) {
      console.error('❌ Superball winner number already posted for this draw date!')
    } else {
      console.error('❌ Error:', err.message)
    }
    process.exit(1)
  }
}

main()

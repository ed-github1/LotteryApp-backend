// Script 2: Draw winner number and distribute prizes

import SuperballOrder from '../models/superballOrder.js'
import SuperballWinner from '../models/superballWinner.js'
import { awardSuperballWinners, getCurrentSuperballJackpot } from '../utils/awardSuperballWinners.js'
import connectToDatabase from '../utils/db.js'

async function drawWinner() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB\n')

    // Get all orders
    const orders = await SuperballOrder.find().populate('user')
    
    if (orders.length === 0) {
      console.log('❌ No orders found. Run 1-generateSuperballOrders.js first')
      process.exit(1)
    }

    console.log(`📊 Found ${orders.length} orders\n`)

    // Show all tickets
    console.log('🎫 All Tickets:')
    orders.forEach((order, i) => {
      order.tickets.forEach((ticket, j) => {
        console.log(`   ${i + 1}. ${order.user.email}: [${ticket.numbers.join(', ')}]`)
      })
    })

    // Get jackpot
    const jackpotInfo = await getCurrentSuperballJackpot()
    const jackpot = jackpotInfo ? jackpotInfo.amount : 25000
    console.log(`\n💰 Current Jackpot: $${jackpot.toFixed(2)} USDT\n`)

    // Generate random winner number (1-10)
    const winnerNumber = Math.floor(Math.random() * 10) + 1
    console.log(`🎲 WINNER NUMBER: ${winnerNumber}\n`)

    // Check who wins
    console.log('🔍 Checking for winners...\n')
    let potentialWinners = []
    
    orders.forEach(order => {
      order.tickets.forEach(ticket => {
        if (ticket.numbers.includes(winnerNumber)) {
          potentialWinners.push({
            email: order.user.email,
            ticket: ticket.numbers
          })
        }
      })
    })

    if (potentialWinners.length === 0) {
      console.log('❌ No winners! Number', winnerNumber, 'not in any tickets')
      console.log('🔄 Run again to try another number')
      process.exit(0)
    }

    console.log(`✅ Found ${potentialWinners.length} winner(s)!\n`)
    
    const prizePerWinner = jackpot / potentialWinners.length
    
    potentialWinners.forEach((winner, i) => {
      console.log(`   ${i + 1}. ${winner.email}`)
      console.log(`      Ticket: [${winner.ticket.join(', ')}]`)
      console.log(`      Prize: $${prizePerWinner.toFixed(2)} USDT`)
      console.log('')
    })

    // Confirm
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Proceeding to award winners in 3 seconds...')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Award winners
    const drawDate = orders[0].tickets[0].drawDate
    await awardSuperballWinners(drawDate, winnerNumber, jackpot)

    console.log('\n✅ SUCCESS!')
    console.log(`🏆 Winner Number: ${winnerNumber}`)
    console.log(`👥 Total Winners: ${potentialWinners.length}`)
    console.log(`💰 Prize Per Winner: $${prizePerWinner.toFixed(2)} USDT`)
    console.log(`📧 All winners notified!`)
    console.log('\n🔍 Check results: node checkPendingUSDTDeposits.js')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

drawWinner()

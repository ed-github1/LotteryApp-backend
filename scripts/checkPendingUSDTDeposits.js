import connectToDatabase from '../utils/db.js'
import SuperballWinner from '../models/superballWinner.js'

/**
 * Check all pending USDT deposits from Superball winners
 */
async function checkPendingUSDTDeposits() {
  try {
    await connectToDatabase()
    
    console.log('\n💰 === PENDING USDT DEPOSITS ===\n')
    
    // Find all Superball winner records
    const allDraws = await SuperballWinner.find().sort({ drawDate: -1 })
    
    if (allDraws.length === 0) {
      console.log('No Superball draws found.')
      process.exit(0)
      return
    }
    
    let totalPending = 0
    let totalPendingAmount = 0
    const pendingByDraw = []
    
    for (const draw of allDraws) {
      const pendingWinners = draw.winners.filter(w => w.depositPending)
      
      if (pendingWinners.length > 0) {
        const drawAmount = pendingWinners.reduce((sum, w) => sum + w.prize, 0)
        totalPending += pendingWinners.length
        totalPendingAmount += drawAmount
        
        pendingByDraw.push({
          drawDate: draw.drawDate,
          winnerNumber: draw.winnerNumber,
          pendingCount: pendingWinners.length,
          amount: drawAmount,
          winners: pendingWinners
        })
      }
    }
    
    if (totalPending === 0) {
      console.log('✅ No pending USDT deposits!')
      console.log('All winners have been paid.\n')
      process.exit(0)
      return
    }
    
    console.log(`⚠️  Total Pending Deposits: ${totalPending}`)
    console.log(`💵 Total Pending Amount: $${totalPendingAmount.toFixed(2)} USDT\n`)
    
    // Show by draw
    pendingByDraw.forEach((draw, i) => {
      console.log(`━━━ Draw ${i + 1}: ${draw.drawDate.toISOString().split('T')[0]} ━━━`)
      console.log(`Winner Number: ${draw.winnerNumber}`)
      console.log(`Pending Winners: ${draw.pendingCount}`)
      console.log(`Total Amount: $${draw.amount.toFixed(2)} USDT\n`)
      
      draw.winners.forEach((winner, j) => {
        console.log(`  ${j + 1}. ${winner.email}`)
        console.log(`     Prize: $${winner.prize.toFixed(2)} USDT`)
        console.log(`     Ticket: [${winner.ticket.join(', ')}]`)
        console.log(`     Status: Pending deposit\n`)
      })
    })
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💡 To mark deposits as completed:')
    console.log('   node markUSDTDepositComplete.js <drawDate> <email>')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkPendingUSDTDeposits()

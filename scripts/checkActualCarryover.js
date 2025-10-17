import connectToDatabase from '../utils/db.js'
import WinnerNumber from '../models/winnerNumber.js'

async function checkActualCarryover() {
  try {
    await connectToDatabase()
    
    console.log('\n=== ACTUAL DATABASE CARRYOVER ===\n')
    
    const draws = await WinnerNumber.find({}).sort({ drawDate: 1 })
    
    console.log('Draw | Date       | Carryover | Streak | Superball Transfer')
    console.log('-----|------------|-----------|--------|-------------------')
    
    for (let i = 0; i < draws.length; i++) {
      const draw = draws[i]
      console.log(
        `${String(i + 1).padStart(4)} | ` +
        `${draw.drawDate.toISOString().split('T')[0]} | ` +
        `$${String((draw.carryover || 0).toFixed(2)).padStart(8)} | ` +
        `${String(draw.noCat1Streak || 0).padStart(6)} | ` +
        `${draw.superballTransfer ? '$' + draw.superballTransfer.toFixed(2) : '-'}`
      )
    }
    
    // Find the draw with Superball transfer
    const superballDraw = draws.find(d => d.superballTransfer > 0)
    
    if (superballDraw) {
      console.log(`\n🎯 Superball triggered on draw ${draws.indexOf(superballDraw) + 1}`)
      console.log(`Amount transferred: $${superballDraw.superballTransfer.toFixed(2)}`)
    } else {
      const lastDraw = draws[draws.length - 1]
      console.log(`\n⏳ Superball not yet triggered`)
      console.log(`Current streak: ${lastDraw?.noCat1Streak || 0}`)
      console.log(`Current carryover: $${(lastDraw?.carryover || 0).toFixed(2)}`)
    }
    
    console.log('\n')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    process.exit(0)
  }
}

checkActualCarryover()

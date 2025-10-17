// Setup complete Superball test scenario
// 1. Create 10 draws with no Cat 1 winners (builds carryover)
// 2. Trigger Superball on 10th draw
// 3. Create Superball entries

import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'
import SuperballOrder from '../models/superballOrder.js'
import User from '../models/user.js'
import connectToDatabase from '../utils/db.js'
import bcrypt from 'bcryptjs'

async function setupSuperballTest() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB\n')

    // Clear existing data
    await WinnerNumber.deleteMany({})
    await Order.deleteMany({})
    await SuperballOrder.deleteMany({})
    console.log('🗑️  Cleared old data\n')

    // Create 10 draws with carryover building up
    console.log('📅 Creating 10 draws with carryover...\n')
    
    let carryover = 0
    const startDate = new Date('2025-10-01')
    
    for (let i = 0; i < 10; i++) {
      const drawDate = new Date(startDate)
      drawDate.setDate(drawDate.getDate() + i * 3) // Every 3 days
      
      // Create 5 paid orders for this draw (no Cat 1 winners)
      const totalSales = 500 // $500 in sales
      const commission = totalSales * 0.35
      const salesPrizePool = totalSales * 0.65 // $325
      const prizePool = salesPrizePool + carryover
      
      // Distribute only lower category prizes (~10% of pool)
      const distributedPrize = prizePool * 0.10
      
      // Calculate new carryover (90% remains)
      carryover = prizePool - distributedPrize
      
      const noCat1Streak = i + 1
      const isLastDraw = i === 9
      
      // On 10th draw, trigger Superball transfer
      const superballTransfer = isLastDraw ? carryover : 0
      if (isLastDraw) {
        carryover = 0 // Transfer all to Superball
      }
      
      const winnerNumbers = new Map()
      winnerNumbers.set('CA', 10 + i)
      winnerNumbers.set('IT', 20 + i)
      winnerNumbers.set('MX', 30 + i)
      winnerNumbers.set('NZ', 40 + i)
      winnerNumbers.set('KR', 50 + i)
      winnerNumbers.set('IE', 1 + i)
      winnerNumbers.set('UK', 2 + i)
      winnerNumbers.set('FR', 3 + i)
      
      await WinnerNumber.create({
        drawDate,
        winnerNumbers,
        carryover: Number(carryover.toFixed(2)),
        noCat1Streak,
        superballTransfer: superballTransfer > 0 ? Number(superballTransfer.toFixed(2)) : undefined
      })
      
      console.log(`Draw ${i + 1}: ${drawDate.toISOString().split('T')[0]}`)
      console.log(`   Sales: $${totalSales.toFixed(2)}`)
      console.log(`   Prize Pool: $${prizePool.toFixed(2)}`)
      console.log(`   Distributed: $${distributedPrize.toFixed(2)}`)
      console.log(`   Carryover: $${carryover.toFixed(2)}`)
      console.log(`   No Cat1 Streak: ${noCat1Streak}`)
      if (superballTransfer > 0) {
        console.log(`   🎯 SUPERBALL TRANSFER: $${superballTransfer.toFixed(2)}`)
      }
      console.log('')
    }

    console.log('✅ 10 draws created!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Now create 10 users with Superball entries
    console.log('👥 Creating 10 users with Superball entries...\n')
    
    const superballDrawDate = new Date()
    
    for (let i = 1; i <= 10; i++) {
      const email = `user${i}@test.com`
      
      // Delete if exists
      await User.deleteOne({ email })
      
      // Create user
      const user = await User.create({
        email,
        name: `User ${i}`,
        passwordHash: await bcrypt.hash('password123', 10),
        usdt: 1000
      })
      
      // Generate 5 unique numbers from 1-10
      const numbers = []
      while (numbers.length < 5) {
        const num = Math.floor(Math.random() * 10) + 1
        if (!numbers.includes(num)) {
          numbers.push(num)
        }
      }
      numbers.sort((a, b) => a - b)

      await SuperballOrder.create({
        user: user._id,
        tickets: [
          {
            numbers: numbers,
            drawDate: superballDrawDate
          }
        ]
      })

      console.log(`✅ ${email} → [${numbers.join(', ')}]`)
    }

    console.log('\n✅ SUCCESS!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Summary:')
    console.log('   • 10 regular draws with carryover buildup')
    console.log('   • Superball triggered on draw 10')
    console.log('   • 10 users with Superball entries')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n🎯 Next: Run node 2-drawSuperballWinner.js')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

setupSuperballTest()

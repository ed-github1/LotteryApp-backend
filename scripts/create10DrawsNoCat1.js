// Usage: node create10DrawsNoCat1.js
// Creates 10 consecutive daily draws with winner numbers that produce NO Category 1 winners
// Also creates 10 test orders for each draw
// This will trigger Superball after the 10th draw

import WinnerNumber from '../models/winnerNumber.js'
import Order from '../models/order.js'
import User from '../models/user.js'
import connectToDatabase from '../utils/db.js'
import { calculateDrawCarryover } from '../utils/carryover.js'
import bcrypt from 'bcryptjs'
import { DateTime } from 'luxon'

async function main() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB')

    // Create 10 test users if needed
    const users = []
    for (let i = 1; i <= 10; i++) {
      const email = `user${i}@test.com`
      let user = await User.findOne({ email })
      if (!user) {
        user = await User.create({
          email,
          name: `User ${i}`,
          passwordHash: await bcrypt.hash('password123', 10),
          credits: 1000
        })
        console.log(`✅ Created user: ${email}`)
      }
      users.push(user)
    }

    // Start date: Oct 14, 2025 at 19:00:00 America/Mexico_City
    const startDate = DateTime.fromObject({ year: 2025, month: 10, day: 14, hour: 19, minute: 0, second: 0 }, { zone: 'America/Mexico_City' })

    console.log('\n🎲 Creating 10 daily draws with NO Category 1 winners...\n')

    for (let i = 0; i < 10; i++) {
      // Calculate drawDate as string in local time
      const drawDate = startDate.plus({ days: i }).toFormat('yyyy-MM-dd HH:mm:ss')

      // Create 10 test orders for this draw
      console.log(`📝 Creating orders for draw ${i + 1} (${drawDate.split(' ')[0]})...`)
      for (let j = 0; j < 10; j++) {
        // Generate 7 unique numbers from 1-59 for main draw, 1 for FR
        const selections = {}
        const nums = []
        while (nums.length < 7) {
          const n = Math.floor(Math.random() * 59) + 1
          if (!nums.includes(n)) nums.push(n)
        }
        selections.CA = nums[0]
        selections.IT = nums[1]
        selections.MX = nums[2]
        selections.NZ = nums[3]
        selections.KR = nums[4]
        selections.IE = nums[5]
        selections.UK = nums[6]
        selections.FR = Math.floor(Math.random() * 12) + 1

        await Order.create({
          user: users[j]._id,
          drawDate,
          selections,
          paymentStatus: 'paid',
          total: 10,
          tkid: `T${Date.now()}${i}${j}`,
          tickets: [
            {
              selections,
              drawDate,
              price: 10
            }
          ]
        })
      }
      console.log(`   ✅ 10 orders created`)

      // Check if draw already exists
      const existing = await WinnerNumber.findOne({ drawDate })
      if (existing) {
        console.log(`⚠️  Draw ${i + 1} winner numbers already exist, skipping winner number creation...`)
        continue
      }

      // Generate winner numbers that ensure NO Cat 1 winners (7 matches)
      // Use high numbers (50-59) that are unlikely to match test tickets
      const winnerNumbers = {
        CA: 50 + (i % 10),
        IT: 51 + (i % 9),
        MX: 52 + (i % 8),
        NZ: 53 + (i % 7),
        KR: 54 + (i % 6),
        IE: 55 + (i % 5),
        UK: 56 + (i % 4),
        FR: 1 + (i % 12)
      }

      // Create winner number document
      await WinnerNumber.create({ drawDate, winnerNumbers })

      // Calculate carryover (this will track the streak and trigger Superball on draw 10)
      const result = await calculateDrawCarryover(drawDate, winnerNumbers)

      console.log(`✅ Draw ${i + 1} winner numbers posted:`)
      console.log(`   Winner Numbers: ${Object.values(winnerNumbers).slice(0, 7).join(', ')} | FR: ${winnerNumbers.FR}`)
      console.log(`   Carryover: $${result.carryover.toFixed(2)}`)
      console.log(`   No Cat1 Streak: ${result.noCat1Streak}`)
      
      if (result.triggeredSuperball) {
        console.log(`\n🎯 SUPERBALL TRIGGERED! Transfer: $${result.superballTransfer.toFixed(2)}\n`)
      }
      console.log('')
    }

    console.log('\n✅ All 10 draws and orders created successfully!')
    console.log('💡 Superball should now be triggered.\n')
    
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()

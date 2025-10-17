// Script 1: Generate 10 Superball orders (1 ticket each, all different)

import User from '../models/user.js'
import SuperballOrder from '../models/superballOrder.js'
import connectToDatabase from '../utils/db.js'
import bcrypt from 'bcryptjs'

async function generateOrders() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB\n')

    // Clear existing orders
    await SuperballOrder.deleteMany({})
    console.log('🗑️  Cleared old Superball orders\n')

    // Create 10 users with 10 different tickets
    const testUsers = []
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
      
      testUsers.push(user)
      console.log(`✅ Created user: ${email}`)
    }

    console.log('\n📝 Creating Superball orders...\n')

    // Create orders - each user gets 1 ticket with 5 unique numbers
    const drawDate = new Date()
    const allTickets = []

    for (let i = 0; i < 10; i++) {
      // Generate 5 unique numbers from 1-10
      const numbers = []
      while (numbers.length < 5) {
        const num = Math.floor(Math.random() * 10) + 1
        if (!numbers.includes(num)) {
          numbers.push(num)
        }
      }
      numbers.sort((a, b) => a - b)

      const order = await SuperballOrder.create({
        user: testUsers[i]._id,
        tickets: [
          {
            numbers: numbers,
            drawDate: drawDate
          }
        ]
      })

      console.log(`Order ${i + 1}: ${testUsers[i].email} → [${numbers.join(', ')}]`)
      allTickets.push({ email: testUsers[i].email, numbers })
    }

    console.log('\n✅ SUCCESS!')
    console.log(`📊 Created 10 orders with 1 ticket each`)
    console.log(`📅 Draw Date: ${drawDate.toISOString()}`)
    console.log('\n🎯 Now run: node 2-drawSuperballWinner.js')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

generateOrders()

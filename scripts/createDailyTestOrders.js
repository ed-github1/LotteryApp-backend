// Usage: node createDailyTestOrders.js [YYYY-MM-DD]
// Creates 10 users (if needed) and 10 paid orders for the given draw date
// If no date provided, uses the current draw date from schedule

import User from '../models/user.js'
import Order from '../models/order.js'
import connectToDatabase from '../utils/db.js'
import bcrypt from 'bcryptjs'
import { getNextDrawDateForCountry } from '../controllers/drawSchedule.js'
import { DateTime } from 'luxon'

let drawDate

// If date argument provided, use it; otherwise use current draw date
if (process.argv[2]) {
  const drawDateArg = process.argv[2]
  // Parse as local date in America/Mexico_City, set time to 19:00:00
  drawDate = DateTime.fromFormat(drawDateArg + ' 19:00:00', 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Mexico_City' }).toFormat('yyyy-MM-dd HH:mm:ss')
  console.log('📅 Using provided date:', drawDate)
} else {
  // Auto-detect current draw date (returns ISO string or Date)
  let detected = getNextDrawDateForCountry('IT', new Date())
  // Normalize to string in local time
  let dt
  if (typeof detected === 'string') {
    dt = DateTime.fromISO(detected, { zone: 'America/Mexico_City' })
  } else {
    dt = DateTime.fromJSDate(detected, { zone: 'America/Mexico_City' })
  }
  drawDate = dt.toFormat('yyyy-MM-dd HH:mm:ss')
  console.log('📅 Auto-detected current draw date:', drawDate)
}

async function main() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB')

    // Create 10 users if not exist
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

    // Create 10 paid orders for this draw
    for (let i = 0; i < 10; i++) {
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
        user: users[i]._id,
        drawDate,
        selections,
        paymentStatus: 'paid',
        total: 10,
        tkid: `T${Date.now()}${i}`,
        tickets: [
          {
            selections,
            drawDate,
            price: 10
          }
        ]
      })
      console.log(`Order: ${users[i].email} → [${Object.values(selections).join(', ')}]`)
    }

    console.log(`\n✅ 10 paid orders created for draw ${drawDate}`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()

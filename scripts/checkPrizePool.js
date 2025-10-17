// Check prize pool for a specific date
import Order from '../models/order.js'
import connectToDatabase from '../utils/db.js'

const drawDateArg = process.argv[2] || '2025-10-15'

async function main() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB')

    const inputDate = new Date(drawDateArg)
    const start = new Date(inputDate)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(inputDate)
    end.setUTCHours(23, 59, 59, 999)

    console.log(`\nChecking orders for ${drawDateArg}:`)
    console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}\n`)

    // Query orders
    const orders = await Order.find({
      drawDate: { $gte: start, $lte: end },
      paymentStatus: 'paid'
    })

    console.log(`Found ${orders.length} paid orders`)
    
    if (orders.length > 0) {
      const totalSold = orders.reduce((sum, order) => sum + order.total, 0)
      const prizePool = totalSold * 0.65
      
      console.log(`\nPrize Pool Details:`)
      console.log(`  Total Sold: $${totalSold.toFixed(2)}`)
      console.log(`  Commission (35%): $${(totalSold * 0.35).toFixed(2)}`)
      console.log(`  Prize Pool (65%): $${prizePool.toFixed(2)}`)
      
      console.log(`\nSample orders:`)
      orders.slice(0, 3).forEach((order, i) => {
        console.log(`  ${i + 1}. DrawDate: ${order.drawDate.toISOString()}, Total: $${order.total}, Tickets: ${order.tickets?.length || 0}`)
      })
    } else {
      console.log('\n❌ No paid orders found for this date!')
      console.log('   Make sure you ran: node createDailyTestOrders.js ' + drawDateArg)
    }

    process.exit(0)
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()

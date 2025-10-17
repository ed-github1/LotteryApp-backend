import Order from '../models/order.js'
import WinnerNumber from '../models/winnerNumber.js'


const CATEGORIES = [
  { hits: 7, percent: 90, extra: 0.5 }, // Category 1: 7 hits + extra for additional number
  { hits: 6, percent: 20, extra: 0.5 }, // Category 2: 6 hits + extra
  { hits: 5, percent: 15, extra: 0.5 }, // Category 3: 5 hits + extra
  { hits: 4, percent: 10, extra: 0.5 }, // Category 4: 4 hits + extra
  { hits: 3, percent: 8,  extra: 0.5 }, // Category 5: 3 hits + extra
  { hits: 2, percent: 6,  extra: 0.5 }, // Category 6: 2 hits + extra
  { hits: 1, percent: 4,  extra: 0.5 }, // Category 7: 1 hit + extra
]

// Main function to calculate winners and distribute prizes for a given draw.
// Parameters:
// - winningNumbers: Array of main winning numbers (e.g., [1, 2, 3, 4, 5, 6, 7])
// - additionalNumber: The additional   number for extra prizes
// - drawDate: The date of the draw to filter tickets
// - acumulado: The total accumulated pot for prize distribution
export async function awardWinners({ winningNumbers, additionalNumber, drawDate, acumulado }) {
  // Fetch all paid orders that have tickets for the specified draw date
  const orders = await Order.find({ 'tickets.drawDate': drawDate, paymentStatus: 'paid' }).populate('user')
  
  // Flatten all tickets from the orders into a single array for easier processing
  const tickets = []
  orders.forEach(order => {
    order.tickets.forEach(ticket => {
      tickets.push({ ticket, order, user: order.user })
    })
  })

  // Initialize categorized winners arrays for each category
  const categorized = CATEGORIES.map(cat => ({ ...cat, winners: [], winnersExtra: [] }))
  let onlyExtraWinners = [] // For tickets that only match the additional number

  // Loop through each ticket to count hits and check for additional number match
  tickets.forEach(({ ticket, order, user }) => {
    const nums = ticket.numbers // Array of numbers on the ticket
    const hits = nums.filter(n => winningNumbers.includes(n)).length // Count how many main numbers match
    const hasExtra = nums.includes(additionalNumber) // Check if ticket has the additional number
    
    // Find the category based on hits
    const cat = CATEGORIES.find(c => c.hits === hits)
    if (cat) {
      if (hasExtra) {
        // Add to winnersExtra if it has the additional number
        categorized.find(c => c.hits === hits).winnersExtra.push({ ticket, order, user })
      } else if (hits > 0) {
        // Add to winners if it has hits but no additional
        categorized.find(c => c.hits === hits).winners.push({ ticket, order, user })
      }
    } else if (hasExtra && hits === 0) {
      // Only additional number match
      onlyExtraWinners.push({ ticket, order, user })
    }
  })

  let result = [] // Array to hold the final winners with prizes

  // If there are winners in Category 1 (7 hits), only distribute prizes for this category
  if (categorized[0].winners.length > 0 || categorized[0].winnersExtra.length > 0) {
    const totalWinners = categorized[0].winners.length
    const totalExtra = categorized[0].winnersExtra.length
    // Calculate prize per winner for main and extra
    const prize = (acumulado * (categorized[0].percent / 100)) / (totalWinners || 1)
    const prizeExtra = (acumulado * (categorized[0].extra / 100)) / (totalExtra || 1)
    result = [
      ...categorized[0].winners.map(w => ({ ...w, category: 1, prize })),
      ...categorized[0].winnersExtra.map(w => ({ ...w, category: 1, prize: prizeExtra, extra: true }))
    ]
  } else {
    // If no Category 1 winners, distribute prizes across other categories
    categorized.forEach((cat, idx) => {
      if (cat.winners.length > 0) {
        const prize = (acumulado * (cat.percent / 100)) / cat.winners.length
        result.push(...cat.winners.map(w => ({ ...w, category: idx + 1, prize })))
      }
      if (cat.winnersExtra.length > 0) {
        const prizeExtra = (acumulado * (cat.extra / 100)) / cat.winnersExtra.length
        result.push(...cat.winnersExtra.map(w => ({ ...w, category: idx + 1, prize: prizeExtra, extra: true })))
      }
    })
    // Handle only additional number winners
    if (onlyExtraWinners.length > 0) {
      const prizeExtra = (acumulado * 0.5 / 100) / onlyExtraWinners.length
      result.push(...onlyExtraWinners.map(w => ({ ...w, category: 'solo-adicional', prize: prizeExtra, extra: true })))
    }
  }

  // Return the list of winners with their prizes
  return result
}

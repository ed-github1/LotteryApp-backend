import mongoose from 'mongoose'

const superballWinnerSchema = new mongoose.Schema({
  drawDate: { type: Date, required: true, unique: true },
  winnerNumber: { type: Number, required: true }, // Single winning number (1-10)
  jackpotAmount: { type: Number, required: true }, // Amount transferred from regular lottery (USDT)
  totalWinners: { type: Number, default: 0 }, // Number of winners
  prizePerWinner: { type: Number, default: 0 }, // USDT amount each winner gets
  winners: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    ticket: [Number],
    prize: Number,
    notified: { type: Boolean, default: false },
    depositPending: { type: Boolean, default: true },
    depositedAt: Date
  }],
  createdAt: { type: Date, default: Date.now }
})

superballWinnerSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

const SuperballWinner = mongoose.model('SuperballWinner', superballWinnerSchema)

export default SuperballWinner

import mongoose from 'mongoose'

const winnerNumberSchema = new mongoose.Schema({
  drawDate: { type: String, required: true, unique: true },
  winnerNumbers: { type: Map, of: Number, required: true },
  carryover: { type: Number, default: 0 }, // Prize pool carried over to next draw
  superballTransfer: { type: Number }, // Amount transferred to Superball (if triggered)
  noCat1Streak: { type: Number, default: 0 } // Consecutive draws without Cat 1 winner
})

const WinnerNumber = mongoose.model('WinnerNumber', winnerNumberSchema)
export default WinnerNumber

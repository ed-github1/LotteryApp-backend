import mongoose from 'mongoose'

const rejectedOrderSchema = new mongoose.Schema({
  // Copy the same fields from Order model
  tickets: [{ selections: Object, price: Number }],
  total: Number,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentStatus: { type: String, default: 'rejected' },
  tkid: String,
  paymentMethod: String,
  drawDate: Date,
  expired: Boolean,
  reason: String,
  archivedAt: { type: Date, default: Date.now }
})

export default mongoose.model('RejectedOrder', rejectedOrderSchema)
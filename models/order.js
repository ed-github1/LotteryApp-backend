import mongoose from 'mongoose'

const ticketSchema = new mongoose.Schema(
  {
    selections: { type: Object, required: true },
    price: { type: Number, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() }
  },
  { _id: false }
)

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'],
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      default: ''
    }
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema({
  tickets: [ticketSchema],
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  total: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'rejected'],
    default: 'pending'
  },
  paymentMethod: String,
  tkid: { type: String, required: true },
  drawDate: { type: String, required: true },
  purchasedDate: { type: Date, default: Date.now },
  expired: { type: Boolean, default: false },
  // Status tracking fields
  statusHistory: [statusHistorySchema],
  // Status-specific fields
  paymentDate: {
    type: Date,
    default: null
  },
  rejectedDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  restoredDate: {
    type: Date,
    default: null
  }
})

orderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    if (returnedObject.tickets) {
      returnedObject.tickets = returnedObject.tickets.map(ticket => ({
        ...ticket,
        id: ticket.id ? ticket.id.toString() : undefined
      }))
    }
    delete returnedObject._id
    delete returnedObject.__v
  }
})

const Order = mongoose.model('Order', orderSchema)

export default Order

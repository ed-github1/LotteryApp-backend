import mongoose from 'mongoose'

const superballTicketSchema = new mongoose.Schema({
  numbers: { type: [Number], required: true },
  drawDate: { type: Date, required: true }
}, { _id: false })

const superballOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tickets: { type: [superballTicketSchema], required: true },
  createdAt: { type: Date, default: Date.now }
})

superballOrderSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

const SuperballOrder = mongoose.model('SuperballOrder', superballOrderSchema)
export default SuperballOrder
import mongoose from 'mongoose'

// Esquema del Usuario
const userSchema = new mongoose.Schema({
  email: {
    required: true,
    unique: true,
    type: String
  },
  passwordHash: {
    required: true,
    type: String
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    default: 'user'
  },
  verified: {
    type: Boolean,
    default: false
  },
  usdt: {
    type: Number,
    default: 0
  }
})

userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
    // el passwordHash no debe mostrarse
    delete returnedObject.passwordHash
  }
})

const User = mongoose.model('User', userSchema)

export default User

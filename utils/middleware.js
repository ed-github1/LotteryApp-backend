import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './config.js'
import User from '../models/user.js'

export const errorHandler = (error, res, next) => {
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'malformatted id' })
  } else if (error.name === 'validation error') {
    return res.status(400).json({ error: error.message })
  } else if (
    error.name === 'MongoServerError' &&
    error.message.includes('E11000 duplicate key error')
  ) {
    return res.status(400).json({ error: 'expected `username` to be unique' })
  } else if (error.name === 'jsonWebTokenError') {
    return res.status(401).json({ error: 'invalid  token' })
  } else if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'token expired' })
  }
}

export const unkkwonEndpoint = (req, res) => {
  return res.status(404).send({ error: 'Unknown Endpoint' })
}

export const tokenExtractor = (req, res, next) => {
  const authorization = req.get('authorization')
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    console.log('No token provided')
    return res.status(401).json({ error: 'token missing or invalid' })
  }
  try {
    const token = authorization.substring(7)
    const decodedToken = jwt.verify(token, JWT_SECRET) // Use JWT_SECRET instead of process.env.SECRET
    req.userId = decodedToken.id
    console.log('Token decoded, userId:', req.userId)
    next()
  } catch (error) {
    console.log('Token verification failed:', error.message)
    return res.status(401).json({ error: 'token missing or invalid' })
  }
}

export const userExtractor = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      console.log('User not found for userId:', req.userId) // Add this
      return res.status(401).json({ error: 'User not found' })
    }
    req.user = user
    console.log('User fetched:', req.user.role) // Add this
    next()
  } catch (error) {
    console.log('Error in userExtractor:', error)
    next(error)
  }
}

export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'access denied ' })
  }
  next()
}

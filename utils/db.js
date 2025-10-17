import mongoose from 'mongoose'
import { MONGODB_URI } from './config.js'
import logger from './logger.js' // Import your Winston logger

mongoose.set('strictQuery', false)

const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    logger.info('Connected to MongoDB') // Replaced console.log
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`) // Replaced console.error
    process.exit(1)
  }
}

export default connectToDatabase

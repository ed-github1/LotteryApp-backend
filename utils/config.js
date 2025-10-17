import { configDotenv } from 'dotenv'

configDotenv()

export const PORT = process.env.PORT || 3000
export const MONGODB_URI = process.env.MONGODB_URI
export const JWT_SECRET = process.env.JWT_SECRET
export const EMAIL_USER = process.env.EMAIL_USER
export const EMAIL_PASS = process.env.EMAIL_PASS
export const PRICE_PER_SELECTION = process.env.PRICE_PER_SELECTION
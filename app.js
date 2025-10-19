import express from 'express'
import morgan from 'morgan'
import authRouter from './controllers/auth.js'
import connectToDatabase from './utils/db.js'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import usersRouter from './controllers/users.js'
import lotteryRouter from './controllers/lottery.js'
import superballRouter from './controllers/superball.js'
import drawSchedulesRouter from './controllers/drawSchedule.js'
import winnerNumberRouter from './controllers/winnerNumber.js'
import winnersRouter from './controllers/winners.js'
// import './utils/expireOrders.js' // Disabled: Expire old tickets cron job
import './utils/schedule.js'
import { startTicketExpirationJob } from './utils/expireTickets.js'
import { PORT } from './utils/config.js'
import { createServer } from 'http'
import { initializeSocket } from './utils/socket.js'

const app = express()
connectToDatabase()

// Start background job to expire old tickets (runs after each weekly draw)
startTicketExpirationJob()

app.use(express.json())
app.use(morgan('dev'))

//Configuración del rate limiter: limita a 100 peticiones por 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5000, // Limita a 100 peticiones
  message: 'Demasiadas peticiones, por favor inténtalo de nuevo más tarde.'
})

// Aplicar el rate limiter globalmente
app.use(limiter)
app.use(helmet())

app.use(
  cors({
    origin:['https://worldsuperlotto.com','https://worldsuperlotto.netlify.app'],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
  })
)

const server = createServer(app)
const io = initializeSocket(server)

app.use((req, res, next) => {
  req.io = io
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/lottery', lotteryRouter)
app.use('/api/superball', superballRouter)

app.use('/api/drawSchedules', drawSchedulesRouter)
app.use('/api/winner-numbers', winnerNumberRouter)
app.use('/api/winners', winnersRouter)
app.set('trust proxy', 1)

server.listen(PORT, () => console.log(`Server running on ${PORT}`))

export default app

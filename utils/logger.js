import winston from 'winston'

const logger = winston.createLogger({
  level: 'debug', // Log everything for dev
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}]: ${message}`
    })
  ),
  transports: [
    // Console for real-time feedback
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File for persistence
    new winston.transports.File({ filename: 'logs/dev.log' })
  ]
})

export default logger
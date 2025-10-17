import { Server } from 'socket.io'

let io = null

export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { 
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
      credentials: true
    },
    maxHttpBufferSize: 1e6
  })

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Join user-specific room when they connect
    socket.on('join', (userId) => {
      if (userId) {
        socket.join(userId)
        console.log(`User ${userId} joined their room`)
      }
    })

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
    })                                                           
  })

  return io
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized! Call initializeSocket first.')
  }
  return io
}

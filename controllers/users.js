import { Router } from 'express'
import User from '../models/user.js'
const usersRouter = Router()

//get all users (admin only )
usersRouter.get('/', async (req, res) => {
  const users = await User.find({})
  return res.status(200).json({ users })
})

//Get user profile
usersRouter.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  return res.status(200).json(user)
})

//update profile
usersRouter.put('/:id', async (req, res) => {
  try {
    const { telegramId, fullName,  ...rest } = req.body
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { telegramId, ...rest },
      { new: true, runValidators: true }
    )
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    return res.status(200).json(updatedUser)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

//delete profile
usersRouter.delete('/:id', async (req, res) => {})



export default usersRouter

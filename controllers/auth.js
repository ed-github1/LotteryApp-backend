import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import User from '../models/user.js'
import { JWT_SECRET, EMAIL_PASS, EMAIL_USER } from '../utils/config.js'
const authRouter = Router()

//Sending email for verification
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
})

// Register user
authRouter.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body

  // Check if email or username already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { firstName }, { lastName }]
  })
  if (existingUser) {
    return res
      .status(400)
      .json({ message: 'El correo o nombre de usuario ya está registrado.' })
  }

  const saltRounds = 10
  const passwordHash = await bcrypt.hash(password, saltRounds)

  // Save user as verified (since email verification is skipped)
  const user = new User({
    firstName,
    lastName,
    email,
    passwordHash,
    role: 'user',
    verified: true
  })

  //Save User in DB
  await user.save()

  // Create verification email token with user id
  // --- EMAIL VERIFICATION LOGIC COMMENTED OUT FOR PRODUCTION ---
  // const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
  //   expiresIn: '1d'
  // })
  // const verificationLink = `https://www.worldsuperlotto.netlify.app/verify-email?token=${token}`
  // const emailHTML = `...` // Email HTML content
  // await transporter.sendMail({
  //   from: EMAIL_USER,
  //   to: email,
  //   subject: 'Verifica tu correo',
  //   html: `${emailHTML}`
  // })

  // Instead, trigger notification/response directly

  res.json({
    message: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.'
  })
})

//verified the token
authRouter.get('/verify-email', async (req, res) => {
  const { token } = req.query
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(400).json({ message: 'User not found' })
    }
    if (user.verified) {
      return res.status(200).json({ message: 'Email already verified' })
    }
    user.verified = true
    await user.save()
    return res.status(200).json({ message: 'Email verified' })
  } catch (error) {
    return res.status(400).json({ message: 'Invalid or expired token' })
  }
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await User.findOne({ email })

    if (!user || !user.passwordHash) {
      console.log('User not found or password hash missing')
      return res.status(401).json({ error: 'Wrong Credentials' })
    }

    const passwordCorrect = await bcrypt.compare(password, user.passwordHash)

    if (!passwordCorrect) {
      return res.status(401).json({ error: 'Wrong Credentials' })
    }

    const userForToken = {
      email: user.email,
      id: user._id
    }

    const token = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '1d' })

    res.status(200).send({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        credits: user.credits
      }
    })
  } catch (error) {
    console.error('Error during login:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default authRouter

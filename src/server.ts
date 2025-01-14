import 'reflect-metadata'
import bodyParser from 'body-parser'
import express from 'express'
import { createPayment } from './payments/handlers/createPayment'
import { handleWebhook } from './payments/handlers/webhook'
import mongoose from 'mongoose'
import { raise } from './lib/utils'
import dotenv from 'dotenv'
dotenv.config()

if (mongoose.connection.readyState !== 1) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(process.env.MONGODB_URI ?? raise('MONGODB_URI is not set'), {
    tlsInsecure: true,
  })
  console.log('Connected to MongoDB')
}

const app = express()
const port = process.env.PORT || 3000

app.use(bodyParser.json())

app.post('/webhook', handleWebhook)
app.post('/payment', createPayment)

const server = app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`)
})

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`)

  server.close(() => {
    console.log('HTTP server closed')
  })

  try {
    await mongoose.connection.close()
    console.log('MongoDB connection closed')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

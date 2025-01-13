import { json } from 'body-parser'
import express from 'express'
import { handleWebhook } from './payments/handlers/webhook'

const app = express()
const port = process.env.PORT || 3000

app.use(json())

app.post('/webhook', handleWebhook)

app.listen(port, () => {
  console.log(`Webhook server is running on port ${port}`)
})

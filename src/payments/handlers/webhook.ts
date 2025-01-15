import express from 'express'
import { WebhookService } from '../services/method/webhooks'
import { MethodMockClient } from '../services/method/client'

// Initialize services
const methodClient = new MethodMockClient()
const webhookService = new WebhookService(methodClient)

export const handleWebhook = async (req: express.Request, res: express.Response) => {
  const timestamp = new Date().toISOString()
  console.log('----------------------------------------')
  console.log(`[${timestamp}] Webhook Event Received:`)
  console.log(JSON.stringify(req.body, null, 2))
  console.log('----------------------------------------')

  try {
    // Process the webhook event
    await webhookService.processWebhookEvent(req.body)

    res.status(200).json({
      status: 'success',
      message: 'Webhook processed successfully',
      timestamp,
    })
  } catch (error) {
    console.error('Error processing webhook:', error)

    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    })
  }
}

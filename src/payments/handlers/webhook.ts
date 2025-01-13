import express from 'express'

export const handleWebhook = (req: express.Request, res: express.Response) => {
  const timestamp = new Date().toISOString()
  const event = req.body

  console.log('----------------------------------------')
  console.log(`[${timestamp}] Webhook Event Received:`)
  console.log(JSON.stringify(event, null, 2))
  console.log('----------------------------------------')

  res.status(200).json({ status: 'success', timestamp })
}

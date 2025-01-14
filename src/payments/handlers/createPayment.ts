import express from 'express'
import { z } from 'zod'
import { PaymentModel } from '../entities/payment'

const paymentSchema = z.object({
  amount: z
    .number()
    .positive()
    .min(1)
    .transform((val) => Number(val.toFixed(2))),
})

export const createPayment: express.RequestHandler = async (req, res) => {
  try {
    const result = paymentSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        errors: result.error.errors,
      })
      return
    }

    const { amount } = result.data

    const payment = await PaymentModel.create({ amount })
    if (!payment) {
      res.status(500).json({ status: 'error', message: 'Failed to create payment' })
      return
    }

    res.status(200).json({ payment })
  } catch (error) {
    console.error('Error in createPayment:', error)
    res.status(500).json({ status: 'error', message: 'Internal server error' })
  }
}

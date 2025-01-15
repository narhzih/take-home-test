import { z } from 'zod'

// Payment status types
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed'

// Method Payment schema using Zod for runtime validation
export const methodPaymentSchema = z.object({
  id: z.string(),
  source: z.string(),
  destination: z.string(),
  amount: z.number().positive(),
  description: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'reversed']),
  estimated_completion_date: z.string(),
  source_trace_id: z.string().nullable(),
  source_settlement_date: z.string(),
  source_status: z.string(),
  destination_trace_id: z.string().nullable(),
  destination_settlement_date: z.string(),
  destination_status: z.string(),
  reversal_id: z.string().nullable(),
  fee: z.number().nullable(),
  error: z.string().nullable(),
  metadata: z.record(z.string()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Infer TypeScript type from schema
export type MethodPayment = z.infer<typeof methodPaymentSchema>

// Webhook event types
export const webhookEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'payment.created',
    'payment.updated',
    'payment.completed',
    'payment.failed',
    'payment.reversed',
  ]),
  created_at: z.string(),
  data: methodPaymentSchema,
})

export type WebhookEvent = z.infer<typeof webhookEventSchema>

// Error types
export class MethodAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
  ) {
    super(message)
    this.name = 'MethodAPIError'
  }
}

// Request types
export const createPaymentRequestSchema = z.object({
  source: z.string(),
  destination: z.string(),
  amount: z.number().positive(),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
})

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>

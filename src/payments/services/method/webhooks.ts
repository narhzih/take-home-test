import { WebhookEvent, webhookEventSchema } from './types'
import { PaymentModel } from '../../entities/payment'
import { MethodMockClient } from './client'

export class WebhookService {
  constructor(private readonly methodClient: MethodMockClient) {}

  async processWebhookEvent(rawEvent: unknown): Promise<void> {
    const event = await this.validateWebhookEvent(rawEvent)

    switch (event.type) {
      case 'payment.completed':
        await this.handlePaymentCompleted(event)
        break
      case 'payment.failed':
        await this.handlePaymentFailed(event)
        break
      case 'payment.reversed':
        await this.handlePaymentReversed(event)
        break
      default:
        console.log(`Unhandled webhook event type: ${event.type}`)
    }
  }

  private async validateWebhookEvent(rawEvent: unknown): Promise<WebhookEvent> {
    try {
      return webhookEventSchema.parse(rawEvent)
    } catch (error) {
      throw new Error(
        `Invalid webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Handle payment.completed webhook event
   */
  private async handlePaymentCompleted(event: WebhookEvent): Promise<void> {
    const { data: payment } = event

    const dbPayment = await PaymentModel.findOne({ methodPaymentId: payment.id })
    if (!dbPayment) {
      throw new Error(`Payment not found for Method payment ID: ${payment.id}`)
    }

    dbPayment.status = 'completed'
    dbPayment.metadata = {
      ...dbPayment.metadata,
      completedAt: event.created_at,
      settlementDate: payment.destination_settlement_date,
    }

    await dbPayment.save()
    console.log(`Payment ${dbPayment.id} marked as completed`)
  }

  /**
   * Handle payment.failed webhook event
   */
  private async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    const { data: payment } = event

    const dbPayment = await PaymentModel.findOne({ methodPaymentId: payment.id })
    if (!dbPayment) {
      throw new Error(`Payment not found for Method payment ID: ${payment.id}`)
    }

    dbPayment.status = 'failed'
    dbPayment.error = payment.error || 'Payment failed'
    dbPayment.metadata = {
      ...dbPayment.metadata,
      failedAt: event.created_at,
      failureReason: payment.error,
    }

    await dbPayment.save()
    console.log(`Payment ${dbPayment.id} marked as failed`)
  }

  /**
   * Handle payment.reversed webhook event
   */
  private async handlePaymentReversed(event: WebhookEvent): Promise<void> {
    const { data: payment } = event

    const dbPayment = await PaymentModel.findOne({ methodPaymentId: payment.id })
    if (!dbPayment) {
      throw new Error(`Payment not found for Method payment ID: ${payment.id}`)
    }

    dbPayment.status = 'reversed'
    dbPayment.metadata = {
      ...dbPayment.metadata,
      reversedAt: event.created_at,
      reversalId: payment.reversal_id,
    }

    await dbPayment.save()
    console.log(`Payment ${dbPayment.id} marked as reversed`)
  }
}

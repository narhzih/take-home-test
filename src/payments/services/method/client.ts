// src/payments/services/method/client.ts

import { methodPaymentSchema, type MethodPayment } from './types'

export class MethodMockClient {
  private payments: Map<string, MethodPayment> = new Map()

  private generatePaymentId(): string {
    return `pmt_${Math.random().toString(36).substring(2, 12)}`
  }

  private generateDate(daysFromNow: number = 0): string {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toISOString().split('T')[0]
  }

  private createMockPayment(params: {
    source: string
    destination: string
    amount: number
    description?: string
    metadata?: Record<string, string>
  }): MethodPayment {
    const now = new Date().toISOString()
    const paymentId = this.generatePaymentId()

    const payment: MethodPayment = {
      id: paymentId,
      source: params.source,
      destination: params.destination,
      amount: params.amount,
      description: params.description ?? 'Payment',
      status: 'pending',
      estimated_completion_date: this.generateDate(7), // 7 days from now
      source_trace_id: null,
      source_settlement_date: this.generateDate(1), // tomorrow
      source_status: 'pending',
      destination_trace_id: null,
      destination_settlement_date: this.generateDate(7),
      destination_status: 'pending',
      reversal_id: null,
      fee: null,
      error: null,
      metadata: params.metadata ?? null,
      created_at: now,
      updated_at: now,
    }

    return methodPaymentSchema.parse(payment)
  }

  /**
   * Create a new payment
   * @see https://docs.methodfi.com/reference/payments/create
   */
  async createPayment(params: {
    source: string
    destination: string
    amount: number
    description?: string
    metadata?: Record<string, string>
  }): Promise<MethodPayment> {
    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Validate required fields
    if (!params.source || !params.destination || params.amount <= 0) {
      throw new Error('Invalid payment parameters')
    }

    const payment = this.createMockPayment(params)
    this.payments.set(payment.id, payment)

    return payment
  }

  /**
   * Retrieve a payment by ID
   * @see https://docs.methodfi.com/reference/payments/retrieve
   */
  async getPayment(paymentId: string): Promise<MethodPayment> {
    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 50))

    const payment = this.payments.get(paymentId)
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`)
    }

    return payment
  }

  /**
   * Update a payment
   * @see https://docs.methodfi.com/reference/payments/update
   */
  async updatePayment(
    paymentId: string,
    params: Partial<{
      status: MethodPayment['status']
      metadata: Record<string, string>
    }>,
  ): Promise<MethodPayment> {
    // Simulate API latency
    await new Promise((resolve) => setTimeout(resolve, 75))

    const payment = await this.getPayment(paymentId)
    const now = new Date().toISOString()

    const updatedPayment = {
      ...payment,
      ...params,
      updated_at: now,
    }

    this.payments.set(paymentId, updatedPayment)
    return updatedPayment
  }

  /**
   * Helper method for simulating webhook events in tests
   * Not part of the actual Method API
   */
  async simulateWebhookEvent(
    paymentId: string,
    eventType: 'completed' | 'failed' | 'reversed',
  ): Promise<void> {
    const payment = await this.getPayment(paymentId)

    switch (eventType) {
      case 'completed':
        await this.updatePayment(paymentId, {
          status: 'completed',
          metadata: { ...payment.metadata, completed_at: new Date().toISOString() },
        })
        break

      case 'failed':
        await this.updatePayment(paymentId, {
          status: 'failed',
          metadata: {
            ...payment.metadata,
            failed_at: new Date().toISOString(),
            failure_reason: 'insufficient_funds',
          },
        })
        break

      case 'reversed':
        await this.updatePayment(paymentId, {
          status: 'failed',
          metadata: {
            ...payment.metadata,
            reversed_at: new Date().toISOString(),
            reversal_reason: 'customer_request',
          },
        })
        break
    }
  }

  /**
   * Helper method to clear all payments (useful for testing)
   * Not part of the actual Method API
   */
  async clearPayments(): Promise<void> {
    this.payments.clear()
  }
}

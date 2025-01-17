import { MethodMockClient } from './client'
import { PaymentModel } from '../../entities/payment'
import { BlockchainPayment } from '../../../blockchain-listener/types'
import { MethodAPIError, CreatePaymentRequest } from './types'

export class PaymentProcessor {
  constructor(private readonly methodClient: MethodMockClient) {}

  /**
   * Process a blockchain payment by creating a corresponding payment in Method
   */
  async processBlockchainPayment(blockchainPayment: BlockchainPayment): Promise<void> {
    try {
      // Convert bytes32 paymentReference to MongoDB ObjectId format
      const paymentId = blockchainPayment.paymentReference.slice(-24)

      const existingPayment = await PaymentModel.findById(paymentId)
      if (!existingPayment) {
        throw new Error(`Payment not found for reference: ${paymentId}`)
      }

      // Check if payment was already processed
      if (existingPayment.blockchainPaymentId) {
        console.log(
          `Payment already processed for transaction: ${blockchainPayment.transactionHash}`,
        )
        return
      }

      // Create payment request for Method API
      const methodPaymentRequest: CreatePaymentRequest = {
        source: blockchainPayment.from,
        destination: blockchainPayment.to,
        amount: Number(blockchainPayment.paymentTokenAmount),
        description: `Payment from ${blockchainPayment.from}`,
        metadata: {
          blockchainTxHash: blockchainPayment.transactionHash,
          chain: blockchainPayment.chain,
          sourceToken: blockchainPayment.sourceToken,
          paymentToken: blockchainPayment.paymentToken,
        },
      }

      const methodPayment = await this.methodClient.createPayment(methodPaymentRequest)

      existingPayment.methodPaymentId = methodPayment.id
      existingPayment.status = methodPayment.status
      existingPayment.blockchainPaymentId = blockchainPayment.transactionHash
      existingPayment.sourceAddress = blockchainPayment.from
      existingPayment.metadata = {
        chain: blockchainPayment.chain,
        blockNumber: blockchainPayment.blockNumber,
        sourceToken: blockchainPayment.sourceToken,
        sourceTokenAmount: blockchainPayment.sourceTokenAmount,
        paymentToken: blockchainPayment.paymentToken,
        paymentTokenAmount: blockchainPayment.paymentTokenAmount,
        methodPayment: {
          estimatedCompletionDate: methodPayment.estimated_completion_date,
          sourceSettlementDate: methodPayment.source_settlement_date,
        },
      }

      await existingPayment.save()

      console.log(
        `Updated payment ${existingPayment.id} for blockchain transaction ${blockchainPayment.transactionHash}`,
      )
    } catch (error) {
      if (error instanceof MethodAPIError) {
        console.error('Method API error:', {
          message: error.message,
          statusCode: error.statusCode,
          errorCode: error.errorCode,
        })
      } else {
        console.error('Error processing blockchain payment:', error)
      }
      throw error
    }
  }
}

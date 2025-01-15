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
      // Check if payment was already processed
      const existingPayment = await PaymentModel.findOne({
        blockchainPaymentId: blockchainPayment.transactionHash,
      })

      if (existingPayment) {
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

      // Create payment in Method
      const methodPayment = await this.methodClient.createPayment(methodPaymentRequest)

      // Create payment record in our database
      const payment = await PaymentModel.create({
        amount: methodPayment.amount,
        methodPaymentId: methodPayment.id,
        status: methodPayment.status,
        blockchainPaymentId: blockchainPayment.transactionHash,
        sourceAddress: blockchainPayment.from,
        paymentReference: blockchainPayment.paymentReference,
        metadata: {
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
        },
      })

      console.log(
        `Created payment ${payment.id} for blockchain transaction ${blockchainPayment.transactionHash}`,
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

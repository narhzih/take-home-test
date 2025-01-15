import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PaymentModel } from '../entities/payment'
import { PaymentProcessor } from '../services/method/processor'
import { MethodMockClient } from '../services/method/client'
import { Chain } from '../../lib/networks'
import { BlockchainPayment } from '../../blockchain-listener/types'
import '../../__tests__/mongo'

describe('PaymentProcessor', () => {
  const methodClient = new MethodMockClient()
  const paymentProcessor = new PaymentProcessor(methodClient)

  beforeEach(async () => {
    await methodClient.clearPayments()
    await PaymentModel.deleteMany({})
  })

  afterEach(async () => {
    await PaymentModel.deleteMany({})
  })

  const createMockBlockchainPayment = (overrides = {}): BlockchainPayment => ({
    chain: Chain.Ethereum,
    transactionHash: '0x123' as `0x${string}`,
    to: '0x456' as `0x${string}`,
    topic0: '0x789' as `0x${string}`,
    topic1: '0xabc' as `0x${string}`,
    topic2: '0xdef' as `0x${string}`,
    address: '0xfed' as `0x${string}`,
    from: '0xcba' as `0x${string}`,
    sourceToken: '0x987' as `0x${string}`,
    sourceTokenAmount: '1000000000000000000', // 1 ETH
    paymentToken: '0x654' as `0x${string}`,
    paymentTokenAmount: '1000',
    paymentReference: '0x321' as `0x${string}`,
    logIndex: 0,
    transactionIndex: 0,
    blockHash: '0x111' as `0x${string}`,
    blockNumber: 12345,
    eventName: 'Payment',
    ...overrides,
  })

  it('should process new blockchain payment successfully', async () => {
    const blockchainPayment = createMockBlockchainPayment()
    await paymentProcessor.processBlockchainPayment(blockchainPayment)

    const payment = await PaymentModel.findOne({
      blockchainPaymentId: blockchainPayment.transactionHash,
    })

    expect(payment).toBeDefined()
    expect(payment?.sourceAddress).toBe(blockchainPayment.from)
    expect(payment?.paymentReference).toBe(blockchainPayment.paymentReference)
    expect(payment?.status).toBe('pending')
    expect(payment?.amount).toBe(Number(blockchainPayment.paymentTokenAmount))
    expect(payment?.metadata?.chain).toBe(blockchainPayment.chain)
    expect(payment?.methodPaymentId).toBeDefined()
  })

  it('should not process duplicate blockchain payments', async () => {
    const blockchainPayment = createMockBlockchainPayment()

    // Process the same payment twice
    await paymentProcessor.processBlockchainPayment(blockchainPayment)
    await paymentProcessor.processBlockchainPayment(blockchainPayment)

    // Check that only one payment was created
    const payments = await PaymentModel.find({
      blockchainPaymentId: blockchainPayment.transactionHash,
    })
    expect(payments).toHaveLength(1)
  })

  it('should handle Method API errors gracefully', async () => {
    const blockchainPayment = createMockBlockchainPayment({
      paymentTokenAmount: '-1000', // Invalid amount to trigger error
    })

    await expect(paymentProcessor.processBlockchainPayment(blockchainPayment)).rejects.toThrow(
      'Invalid payment parameters',
    )

    // Verify no payment was created in our database
    const payment = await PaymentModel.findOne({
      blockchainPaymentId: blockchainPayment.transactionHash,
    })
    expect(payment).toBeNull()
  })

  it('should store all relevant blockchain data in payment metadata', async () => {
    const blockchainPayment = createMockBlockchainPayment()
    await paymentProcessor.processBlockchainPayment(blockchainPayment)

    const payment = await PaymentModel.findOne({
      blockchainPaymentId: blockchainPayment.transactionHash,
    })

    expect(payment?.metadata).toMatchObject({
      chain: blockchainPayment.chain,
      blockNumber: blockchainPayment.blockNumber,
      sourceToken: blockchainPayment.sourceToken,
      sourceTokenAmount: blockchainPayment.sourceTokenAmount,
      paymentToken: blockchainPayment.paymentToken,
      paymentTokenAmount: blockchainPayment.paymentTokenAmount,
    })
  })

  it('should link Method payment data correctly', async () => {
    const blockchainPayment = createMockBlockchainPayment()
    await paymentProcessor.processBlockchainPayment(blockchainPayment)

    const payment = await PaymentModel.findOne({
      blockchainPaymentId: blockchainPayment.transactionHash,
    })

    expect(payment?.methodPaymentId).toBeDefined()
    expect(payment?.metadata?.methodPayment).toMatchObject({
      estimatedCompletionDate: expect.any(String),
      sourceSettlementDate: expect.any(String),
    })
  })
})

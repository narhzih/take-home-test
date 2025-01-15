import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Chain } from '../../lib/networks'
import { onListenerTick } from '../services/onListenerTick'
import { BlockchainPaymentModel } from '../entities/BlockchainPayment'
import { PaymentModel } from '../../payments/entities/payment'
import * as viemModule from '../../lib/viem'
import { PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import '../../__tests__/mongo'

// Mock viem
vi.mock('../../lib/viem', () => ({
  createClientForChain: vi.fn(),
}))

describe('Blockchain Listener', () => {
  // Sample event log from a real transaction
  const samplePaymentLog = {
    address: '0x0fe08D911246566fdFD4afE0181a21ab810EE1C2' as `0x${string}`,
    blockHash:
      '0x678f0c446da08857488607ad00f35acaa80f7275f6c912cfc05ad61deb64612e' as `0x${string}`,
    blockNumber: BigInt('0xF5FF2D'),
    data: '0x00000000000000000000000000000000000000000000000036c45612c4c50000000000000000000000000000000000000000000000000000000000002aa7780000000000000000000000000000000000000000000000000000000000000000063',
    logIndex: 0x1f1,
    transactionHash:
      '0x5db01a1daf2a2a226a35e50e212888be4efaa6f725be7bb25e2d6aa25f87fc7f' as `0x${string}`,
    transactionIndex: 0xca,
    topics: [
      '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c' as `0x${string}`,
      '0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045' as `0x${string}`,
      '0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as `0x${string}`,
      '0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`,
    ],
  }

  let mockClient: Partial<PublicClient>

  beforeEach(async () => {
    vi.clearAllMocks()
    await BlockchainPaymentModel.deleteMany({})
    await PaymentModel.deleteMany({})

    // Create mock client
    mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(12345)),
      getLogs: vi.fn().mockResolvedValue([samplePaymentLog]),
      chain: { name: Chain.Ethereum.toUpperCase() } as unknown as typeof mainnet,
    }

    vi.mocked(viemModule.createClientForChain).mockReturnValue(mockClient as PublicClient)
  })

  afterEach(async () => {
    await BlockchainPaymentModel.deleteMany({})
    await PaymentModel.deleteMany({})
  })

  it('should detect and process new blockchain payments', async () => {
    const result = await onListenerTick(Chain.Ethereum)

    // Verify blockchain interaction
    expect(mockClient.getBlockNumber).toHaveBeenCalledTimes(1)
    expect(mockClient.getLogs).toHaveBeenCalledTimes(1)

    // Verify return data structure
    expect(result).toMatchObject({
      lastProcessedBlock: 12345,
      payments: expect.arrayContaining([
        expect.objectContaining({
          chain: Chain.Ethereum,
          transactionHash: samplePaymentLog.transactionHash,
          blockNumber: Number(samplePaymentLog.blockNumber),
        }),
      ]),
    })

    // Verify blockchain payment was stored
    const storedBlockchainPayment = await BlockchainPaymentModel.findOne({
      chain: Chain.Ethereum,
      transactionHash: samplePaymentLog.transactionHash,
    })
    expect(storedBlockchainPayment).toBeTruthy()

    // Verify Method payment was created
    const methodPayment = await PaymentModel.findOne({
      blockchainPaymentId: samplePaymentLog.transactionHash,
    })
    expect(methodPayment).toBeTruthy()
    expect(methodPayment?.methodPaymentId).toBeDefined()
    expect(methodPayment?.status).toBe('pending')
  })

  it('should handle empty block ranges', async () => {
    mockClient.getLogs = vi.fn().mockResolvedValue([])
    const result = await onListenerTick(Chain.Ethereum)

    expect(result).toMatchObject({
      lastProcessedBlock: 12345,
      payments: [],
    })

    // Verify no payments were stored
    const blockchainPaymentCount = await BlockchainPaymentModel.countDocuments()
    expect(blockchainPaymentCount).toBe(0)

    const methodPaymentCount = await PaymentModel.countDocuments()
    expect(methodPaymentCount).toBe(0)
  })

  it('should prevent duplicate payment processing', async () => {
    // Create existing blockchain payment
    await BlockchainPaymentModel.create({
      chain: Chain.Ethereum,
      transactionHash: samplePaymentLog.transactionHash,
      logIndex: samplePaymentLog.logIndex,
      blockNumber: Number(samplePaymentLog.blockNumber),
      address: samplePaymentLog.address,
      topic0: samplePaymentLog.topics[0],
      topic1: samplePaymentLog.topics[1],
      topic2: samplePaymentLog.topics[2],
      from: '0x1234' as `0x${string}`,
      to: '0x5678' as `0x${string}`,
      sourceToken: '0x0000' as `0x${string}`,
      sourceTokenAmount: '100',
      paymentToken: '0x1111' as `0x${string}`,
      paymentTokenAmount: '200',
      paymentReference: '0x2222' as `0x${string}`,
      blockHash: samplePaymentLog.blockHash,
      transactionIndex: samplePaymentLog.transactionIndex,
    })

    await onListenerTick(Chain.Ethereum)

    // Verify no duplicate payments were created
    const blockchainPaymentCount = await BlockchainPaymentModel.countDocuments()
    expect(blockchainPaymentCount).toBe(1)

    const methodPaymentCount = await PaymentModel.countDocuments()
    expect(methodPaymentCount).toBe(0) // No Method payment should be created for duplicate
  })

  it('should handle blockchain client errors', async () => {
    mockClient.getLogs = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(onListenerTick(Chain.Ethereum)).rejects.toThrow(
      'Failed to fetch blockchain events',
    )

    // Verify no payments were stored
    const blockchainPaymentCount = await BlockchainPaymentModel.countDocuments()
    expect(blockchainPaymentCount).toBe(0)

    const methodPaymentCount = await PaymentModel.countDocuments()
    expect(methodPaymentCount).toBe(0)
  })

  it('should continue processing remaining payments if one fails', async () => {
    // Create two payment logs, one valid and one with invalid event data structure
    const invalidPaymentLog = {
      ...samplePaymentLog,
      transactionHash: '0x999' as `0x${string}`,
      // Remove required topic to cause decoding failure
      topics: [
        '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c' as `0x${string}`,
        // Missing required topics
      ],
      // Malformed data to cause decoding error
      data: '0x0000',
    }

    // Mock getLogs to return both valid and invalid logs
    mockClient.getLogs = vi.fn().mockResolvedValue([samplePaymentLog, invalidPaymentLog])

    // This should continue despite the invalid log
    const result = await onListenerTick(Chain.Ethereum)

    // Only the valid payment should be processed and stored
    const validBlockchainPayment = await BlockchainPaymentModel.findOne({
      transactionHash: samplePaymentLog.transactionHash,
    })
    expect(validBlockchainPayment).toBeTruthy()

    const validMethodPayment = await PaymentModel.findOne({
      blockchainPaymentId: samplePaymentLog.transactionHash,
    })
    expect(validMethodPayment).toBeTruthy()

    // The invalid payment should not be stored
    const invalidPayments = await BlockchainPaymentModel.find({
      transactionHash: invalidPaymentLog.transactionHash,
    })
    expect(invalidPayments).toHaveLength(0)
  })

  it('should support different blockchain networks', async () => {
    mockClient = {
      ...mockClient,
      chain: { name: Chain.Polygon.toUpperCase() } as unknown as typeof mainnet,
      getLogs: vi.fn().mockResolvedValue([
        {
          ...samplePaymentLog,
          address: '0x0AC79b8711A92340e55ACf6ACceC03df6e181171' as `0x${string}`, // Polygon contract
        },
      ]),
    }
    vi.mocked(viemModule.createClientForChain).mockReturnValue(mockClient as PublicClient)

    const result = await onListenerTick(Chain.Polygon)

    expect(result.payments[0]).toMatchObject({
      chain: Chain.Polygon,
    })

    // Verify payments were stored with correct chain
    const blockchainPayment = await BlockchainPaymentModel.findOne({
      chain: Chain.Polygon,
    })
    expect(blockchainPayment).toBeTruthy()

    const methodPayment = await PaymentModel.findOne({
      'metadata.chain': Chain.Polygon,
    })
    expect(methodPayment).toBeTruthy()
  })
})

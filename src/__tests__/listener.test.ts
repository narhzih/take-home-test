import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Chain } from '../lib/networks'
import { onListenerTick } from '../blockchain-listener/services/onListenerTick'
import { BlockchainPaymentModel } from '../blockchain-listener/entities/BlockchainPayment'
import * as viemModule from '../lib/viem'
import { PublicClient } from 'viem'
import { mainnet } from 'viem/chains'
import './mongo'

vi.mock('../lib/viem', () => ({
  createClientForChain: vi.fn(),
}))

describe('onListenerTick', () => {
  const samplePaymentLog = {
    // transaction data from: 0x5db01a1daf2a2a226a35e50e212888be4efaa6f725be7bb25e2d6aa25f87fc7f
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
      // topic[0]: Event signature
      '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c' as `0x${string}`,
      // topic[1]: From address (vitalik.eth)
      '0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045' as `0x${string}`,
      // topic[2]: Source token (WETH)
      '0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as `0x${string}`,
      // topic[3]: Payment token (USDC)
      '0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`,
    ],
  }

  let mockClient: Partial<PublicClient>

  beforeEach(() => {
    vi.clearAllMocks()

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
  })

  it('should successfully process new blockchain payments', async () => {
    const result = await onListenerTick(Chain.Ethereum)

    // Verify the block number was fetched
    expect(mockClient.getBlockNumber).toHaveBeenCalledTimes(1)

    // Verify logs were fetched
    expect(mockClient.getLogs).toHaveBeenCalledTimes(1)

    // Check the returned data structure
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

    // Verify payment was stored in database
    const storedPayment = await BlockchainPaymentModel.findOne({
      chain: Chain.Ethereum,
      transactionHash: samplePaymentLog.transactionHash,
    })
    expect(storedPayment).toBeTruthy()
  })

  it('should handle empty block ranges with no payments', async () => {
    mockClient.getLogs = vi.fn().mockResolvedValue([])

    const result = await onListenerTick(Chain.Ethereum)

    expect(result).toMatchObject({
      lastProcessedBlock: 12345,
      payments: [],
    })

    // Verify no payments were stored
    const count = await BlockchainPaymentModel.countDocuments()
    expect(count).toBe(0)
  })

  it('should not store duplicate payments', async () => {
    await BlockchainPaymentModel.create({
      chain: Chain.Ethereum,
      transactionHash: samplePaymentLog.transactionHash,
      logIndex: samplePaymentLog.logIndex,
      blockNumber: Number(samplePaymentLog.blockNumber),
      // Add other required fields...
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

    // Verify the payment was processed but not duplicated
    const count = await BlockchainPaymentModel.countDocuments()
    expect(count).toBe(1)
  })

  it('should handle blockchain client errors gracefully', async () => {
    mockClient.getLogs = vi.fn().mockRejectedValue(new Error('Arghhh 🦁 🔥'))

    await expect(onListenerTick(Chain.Ethereum)).rejects.toThrow(
      'Failed to fetch blockchain events',
    )
  })

  it('should process multiple payments in a single block', async () => {
    // Mock multiple payment logs
    const multiplePaymentLogs = [
      samplePaymentLog,
      {
        ...samplePaymentLog,
        transactionHash: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        logIndex: 1,
      },
    ]

    mockClient.getLogs = vi.fn().mockResolvedValue(multiplePaymentLogs)

    const result = await onListenerTick(Chain.Ethereum)

    expect(result.payments).toHaveLength(2)

    // Verify both payments were stored
    const count = await BlockchainPaymentModel.countDocuments()
    expect(count).toBe(2)
  })

  it('should handle different chain configurations', async () => {
    mockClient = {
      ...mockClient,
      chain: { name: Chain.Polygon.toUpperCase() } as unknown as typeof mainnet,
      getBlockNumber: vi.fn().mockResolvedValue(BigInt(12345)),
      getLogs: vi.fn().mockResolvedValue([
        {
          ...samplePaymentLog,
          address: '0x0AC79b8711A92340e55ACf6ACceC03df6e181171' as `0x${string}`, // Polygon contract address
        },
      ]),
    }
    vi.mocked(viemModule.createClientForChain).mockReturnValue(mockClient as PublicClient)

    const result = await onListenerTick(Chain.Polygon)

    expect(result.payments[0]).toMatchObject({
      chain: Chain.Polygon,
    })

    const storedPayment = await BlockchainPaymentModel.findOne({
      chain: Chain.Polygon,
    })
    expect(storedPayment).toBeTruthy()
  })
})

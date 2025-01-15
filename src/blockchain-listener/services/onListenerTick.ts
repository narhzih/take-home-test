import { PublicClient, decodeEventLog } from 'viem'
import { Chain } from '../../lib/networks'
import { createClientForChain } from '../../lib/viem'
import { BlockchainPayment } from '../types'
import { BlockchainPaymentModel } from '../entities/BlockchainPayment'

/**
 * The signature below can be interpreted as:
  address: from (who initiated the payment)
  address: sourceToken (the token being spent)
  uint256: sourceTokenAmount (how much is being spent)
  address: paymentToken (the token being received)
  uint256: paymentTokenAmount (how much is being received)
  bytes32: paymentReference (unique identifier linking to our database)
 */
const PAYMENT_EVENT_SIGNATURE = 'Payment(address,address,uint256,address,uint256,bytes32)' as const

const LAST_BLOCKS = 1_000

export interface ListenerTickResult {
  lastProcessedBlock: number
  payments: BlockchainPayment[]
}

/**
 * TODO: Implement this function to fetch blockchain payments
 * Requirements:
 * 1. Use client to fetch relevant events from the blockchain
 * 2. Parse the events into BlockchainPayment objects
 * 3. Return array of payments
 *
 * @param client - Viem public client for blockchain interaction
 * @param range - Block range to fetch (start and end blocks)
 */
async function getPaymentsForBlockRange(
  client: PublicClient,
  { start, end }: { start: bigint; end: bigint },
): Promise<BlockchainPayment[]> {
  try {
    const logs = await client.getLogs({
      fromBlock: start,
      toBlock: end,
      events: [PAYMENT_EVENT_SIGNATURE],
    })

    return logs.map((log): BlockchainPayment => {
      const decodedLog = decodeEventLog({
        abi: [
          {
            type: 'event',
            name: 'Payment',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'sourceToken', type: 'address', indexed: true },
              { name: 'sourceTokenAmount', type: 'uint256', indexed: false },
              { name: 'paymentToken', type: 'address', indexed: true },
              { name: 'paymentTokenAmount', type: 'uint256', indexed: false },
              { name: 'paymentReference', type: 'bytes32', indexed: false },
            ],
          },
        ],
        data: log.data,
        topics: log.topics,
      })

      return {
        chain: client.chain?.name.toLowerCase() as Chain,
        transactionHash: log.transactionHash,
        to: log.address as `0x${string}`,
        topic0: log.topics[0]!, // I'm not entirely sure that this is always set but, let's see 🥴.
        topic1: log.topics[1]!,
        topic2: log.topics[2]!,
        address: log.address as `0x${string}`,
        from: decodedLog.args.from,
        sourceToken: decodedLog.args.sourceToken,
        sourceTokenAmount: decodedLog.args.sourceTokenAmount.toString(),
        paymentToken: decodedLog.args.paymentToken,
        paymentTokenAmount: decodedLog.args.paymentTokenAmount.toString(),
        paymentReference: decodedLog.args.paymentReference,
        logIndex: log.logIndex,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        blockNumber: Number(log.blockNumber),
        eventName: 'Payment',
      }
    })
  } catch (error) {
    console.error('Error fetching blockchain events:', error)
    throw new Error('Failed to fetch blockchain events')
  }
}

async function storeAndProcessPayments(payments: BlockchainPayment[]): Promise<void> {
  for (const payment of payments) {
    // Check if payment already exists to prevent double processing
    const existingPayment = await BlockchainPaymentModel.findOne({
      chain: payment.chain,
      transactionHash: payment.transactionHash,
      logIndex: payment.logIndex,
    })

    if (!existingPayment) {
      // Store new payment
      const blockchainPayment = await BlockchainPaymentModel.create(payment)

      // Here the payment processing will be triggered via Method API
      // This will be implemented in a separate service, once I'm done reviewing Method's API
      console.log(`Stored new blockchain payment: ${blockchainPayment.id}`)
    } else {
      console.log(`Payment already processed: ${existingPayment.id}`)
    }
  }
}

export async function onListenerTick(chain: Chain): Promise<ListenerTickResult> {
  console.log(`Tick at ${new Date().toISOString()} for ${chain}`)
  const client = createClientForChain(chain)

  const latestBlockNumber = await client.getBlockNumber({ cacheTime: 0 })
  const latestPayments = await getPaymentsForBlockRange(client, {
    start: latestBlockNumber - BigInt(LAST_BLOCKS),
    end: latestBlockNumber,
  })

  if (latestPayments.length > 0) {
    console.log(`Found ${latestPayments.length} payments for ${chain}`)
    await storeAndProcessPayments(latestPayments)
  }

  return {
    lastProcessedBlock: Number(latestBlockNumber),
    payments: latestPayments,
  }
}

import { PublicClient } from 'viem'
import { Chain } from '../../lib/networks'
import { createClientForChain } from '../../lib/viem'
import { BlockchainPayment } from '../types'

const LAST_BLOCKS = 1_000

export interface ListenerTickResult {
  lastProcessedBlock: number
  payments: BlockchainPayment[]
}

/**
 * TODO: Implement this function to fetch blockchain payments
 * Requirements:
 * 1. Use client.getLogs to fetch relevant events from the blockchain
 * 2. Parse the events into BlockchainPayment objects
 * 3. Return array of payments
 *
 * @param client - Viem public client for blockchain interaction
 * @param range - Block range to fetch (start and end blocks)
 */
async function getPaymentsForBlockRange(
  _client: PublicClient,
  { start, end }: { start: bigint; end: bigint },
): Promise<BlockchainPayment[]> {
  console.log('getPaymentsForBlockRange - analyzing range', { start, end })
  throw new Error('Not implemented')
}

/**
 * TODO: Implement this function to store and process payments
 * Requirements:
 * 1. Store the payment in the database
 * 2. Implement deduplication logic to prevent double processing
 * 3. Call payment processing after successful storage
 *
 * @param payments - Array of blockchain payments to store and process
 */
async function storeAndProcessPayments(_payments: BlockchainPayment[]): Promise<void> {
  throw new Error('Not implemented')
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

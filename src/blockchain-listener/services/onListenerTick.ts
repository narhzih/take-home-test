import { PublicClient } from 'viem'
import { Chain } from '../../lib/networks'
import { createClientForChain } from '../../lib/viem'
import { BlockchainPayment } from '../types'

const LAST_BLOCKS = 1_000

async function getPaymentsForBlockRange(
  _client: PublicClient,
  _: { start: bigint; end: bigint },
): Promise<BlockchainPayment[]> {
  // To be implemented
  throw new Error('Not implemented')
}

async function storeAndProcessPayments(_payments: BlockchainPayment[]) {
  // To be implemented
  throw new Error('Not implemented')
}

export async function onListenerTick(chain: Chain) {
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
}

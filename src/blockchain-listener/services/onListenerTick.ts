import { PublicClient, decodeEventLog } from 'viem'
import { Chain } from '../../lib/networks'
import { createClientForChain } from '../../lib/viem'
import { BlockchainPayment } from '../types'
import { BlockchainPaymentModel } from '../entities/BlockchainPayment'
import { PaymentProcessor } from '../../payments/services/method/processor'
import { MethodMockClient } from '../../payments/services/method/client'

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

// Initialize Method client and payment processor
const methodClient = new MethodMockClient()
const paymentProcessor = new PaymentProcessor(methodClient)

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
        topic0: log.topics[0]!,
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
    try {
      // Check if payment already exists to prevent double processing
      const existingPayment = await BlockchainPaymentModel.findOne({
        chain: payment.chain,
        transactionHash: payment.transactionHash,
        logIndex: payment.logIndex,
      })

      if (!existingPayment) {
        // Store blockchain payment
        const blockchainPayment = await BlockchainPaymentModel.create(payment)
        console.log(`Stored new blockchain payment: ${blockchainPayment.id}`)

        // Process payment through Method API
        await paymentProcessor.processBlockchainPayment(payment)
        console.log(
          `Processed payment through Method API for transaction: ${payment.transactionHash}`,
        )
      } else {
        console.log(`Payment already processed: ${existingPayment.id}`)
      }
    } catch (error) {
      console.error(`Error processing payment ${payment.transactionHash}:`, error)
      // Continue processing other payments even if one fails
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

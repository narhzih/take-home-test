import { Chain } from '../lib/networks'

export interface BlockchainPayment {
  chain: Chain
  transactionHash: `0x${string}`
  to: `0x${string}`
  topic0: `0x${string}`
  topic1: `0x${string}`
  topic2: `0x${string}`
  address: `0x${string}`
  from: `0x${string}`
  sourceToken: `0x${string}`
  sourceTokenAmount: string
  paymentToken: `0x${string}`
  paymentTokenAmount: string
  paymentReference: `0x${string}`
  logIndex: number
  transactionIndex: number
  blockHash: `0x${string}`
  blockNumber: number
  eventName: 'Payment'
}

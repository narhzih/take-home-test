import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { Types } from 'mongoose'
import { Chain } from '../../lib/networks'

@modelOptions({
  schemaOptions: {
    collection: 'blockchainpayments',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class BlockchainPayment {
  _id: Types.ObjectId

  id: string

  @prop()
  chain: Chain

  @prop()
  transactionHash: `0x${string}`

  @prop()
  to: `0x${string}`

  @prop()
  topic0: `0x${string}`

  @prop()
  topic1: `0x${string}`

  @prop()
  topic2: `0x${string}`

  @prop()
  address: `0x${string}`

  @prop()
  from: `0x${string}`

  @prop()
  sourceToken: `0x${string}`

  @prop()
  sourceTokenAmount: string

  @prop()
  paymentToken: `0x${string}`

  @prop()
  paymentTokenAmount: string

  @prop()
  paymentReference: `0x${string}`

  @prop()
  logIndex: number

  @prop()
  transactionIndex: number

  @prop()
  blockHash: `0x${string}`

  @prop()
  blockNumber: number

  @prop()
  createdAt: Date

  @prop()
  updatedAt: Date
}

export const BlockchainPaymentModel = getModelForClass(BlockchainPayment)

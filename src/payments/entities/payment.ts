import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { Types } from 'mongoose'
import { PaymentStatus } from '../services/method/types'

@modelOptions({
  schemaOptions: {
    collection: 'payments',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: true,
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class Payment {
  _id: Types.ObjectId

  id: string

  @prop({ required: true })
  public amount: number

  @prop({ required: false })
  public externalId?: string

  @prop({ required: false })
  public methodPaymentId?: string

  @prop({
    required: true,
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
  })
  public status: PaymentStatus

  @prop({ required: false })
  public error?: string

  @prop({ type: () => String, required: false })
  public blockchainPaymentId?: string

  @prop({ type: () => String, required: false })
  public sourceAddress?: string

  @prop({ type: () => String, required: false })
  public paymentReference?: string

  @prop()
  public createdAt: Date

  @prop()
  public updatedAt: Date

  @prop({ type: () => Object, required: false })
  public metadata?: Record<string, any>
}

export const PaymentModel = getModelForClass(Payment)

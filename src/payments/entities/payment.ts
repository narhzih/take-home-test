import { getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { Types } from 'mongoose'

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

  @prop()
  userId: Types.ObjectId

  @prop()
  public createdAt: Date

  @prop()
  public updatedAt: Date
}

export const PaymentModel = getModelForClass(Payment)

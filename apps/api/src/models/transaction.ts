import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PAYMENT_METHODS, SUPPORTED_CURRENCIES, TRANSACTION_TYPES, isIsoDate, monthOf } from '@trackforge/shared';

const transactionSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    /** Positive integer in minor units (cents, paise…). Sign comes from `type`. */
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'amountMinor must be an integer' },
    },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    /** Calendar date "YYYY-MM-DD" in the user's own calendar. */
    date: { type: String, required: true, validate: { validator: isIsoDate, message: 'Invalid date' } },
    /** Derived "YYYY-MM" used for monthly grouping and budget matching. */
    month: { type: String, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    merchant: { type: String, trim: true, maxlength: 80, default: '' },
    merchantKey: { type: String, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    recurring: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, strict: 'throw' },
);

transactionSchema.pre('validate', function deriveFields() {
  if (typeof this.date === 'string') this.month = monthOf(this.date);
  this.merchantKey = (this.merchant ?? '').toLowerCase();
});

transactionSchema.index({ ownerId: 1, date: -1, _id: -1 });
transactionSchema.index({ ownerId: 1, month: 1, type: 1 });
transactionSchema.index({ ownerId: 1, categoryId: 1, month: 1 });

export type TransactionFields = InferSchemaType<typeof transactionSchema>;
export type TransactionDoc = HydratedDocument<TransactionFields>;
export const Transaction = model('Transaction', transactionSchema);

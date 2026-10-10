import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { isIsoMonth } from '@trackforge/shared';

const budgetSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, immutable: true },
    month: { type: String, required: true, immutable: true, validate: { validator: isIsoMonth, message: 'Invalid month' } },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'amountMinor must be an integer' },
    },
    warningThresholdPct: { type: Number, required: true, min: 50, max: 100, default: 80 },
  },
  { timestamps: true, strict: 'throw' },
);

/** One budget per category per month. */
budgetSchema.index({ ownerId: 1, categoryId: 1, month: 1 }, { unique: true });
budgetSchema.index({ ownerId: 1, month: 1 });

export type BudgetFields = InferSchemaType<typeof budgetSchema>;
export type BudgetDoc = HydratedDocument<BudgetFields>;
export const Budget = model('Budget', budgetSchema);

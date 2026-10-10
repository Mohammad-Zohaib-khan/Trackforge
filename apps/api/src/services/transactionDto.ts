import type { Types } from 'mongoose';
import type { CategoryDto, CurrencyCode, PaymentMethod, TransactionDto, TransactionType } from '@trackforge/shared';
import { Category } from '../models/category.js';

export interface TransactionLike {
  _id: Types.ObjectId;
  type: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId: Types.ObjectId;
  date: string;
  paymentMethod: PaymentMethod;
  merchant?: string | null;
  note?: string | null;
  recurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CategorySummary = Pick<CategoryDto, 'id' | 'name' | 'icon' | 'color'>;

/** Loads only the caller's categories referenced by the given transactions. */
export async function categoryMapFor(
  ownerId: Types.ObjectId,
  categoryIds: readonly Types.ObjectId[],
): Promise<Map<string, CategorySummary>> {
  const unique = [...new Set(categoryIds.map((id) => id.toString()))];
  if (unique.length === 0) return new Map();
  const categories = await Category.find({ ownerId, _id: { $in: unique } })
    .select({ name: 1, icon: 1, color: 1 })
    .lean();
  return new Map(
    categories.map((c) => [c._id.toString(), { id: c._id.toString(), name: c.name, icon: c.icon, color: c.color ?? null }]),
  );
}

export function toTransactionDto(t: TransactionLike, categories: Map<string, CategorySummary>): TransactionDto {
  return {
    id: t._id.toString(),
    type: t.type,
    amountMinor: t.amountMinor,
    currency: t.currency,
    date: t.date,
    paymentMethod: t.paymentMethod,
    merchant: t.merchant ?? '',
    note: t.note ?? '',
    recurring: t.recurring,
    category: categories.get(t.categoryId.toString()) ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function toTransactionDtos(ownerId: Types.ObjectId, rows: readonly TransactionLike[]): Promise<TransactionDto[]> {
  const categories = await categoryMapFor(
    ownerId,
    rows.map((r) => r.categoryId),
  );
  return rows.map((r) => toTransactionDto(r, categories));
}

import type { Types } from 'mongoose';
import type { CategoryIcon, TransactionType } from '@trackforge/shared';
import { Category } from '../models/category.js';

interface Starter {
  name: string;
  type: TransactionType;
  icon: CategoryIcon;
  color: string;
}

/** Starter categories copied into every new account. Users can rename, archive or delete them. */
export const STARTER_CATEGORIES: readonly Starter[] = [
  { name: 'Salary', type: 'income', icon: 'briefcase', color: '#94FFD1' },
  { name: 'Freelance', type: 'income', icon: 'wallet', color: '#6BF5FF' },
  { name: 'Investments', type: 'income', icon: 'trending-up', color: '#B8F2E6' },
  { name: 'Gifts', type: 'income', icon: 'gift', color: '#D7FFF0' },
  { name: 'Other income', type: 'income', icon: 'coins', color: '#8FD9C4' },
  { name: 'Housing', type: 'expense', icon: 'home', color: '#6BF5FF' },
  { name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#94FFD1' },
  { name: 'Dining', type: 'expense', icon: 'utensils', color: '#F5D27A' },
  { name: 'Transport', type: 'expense', icon: 'car', color: '#9DB8FF' },
  { name: 'Utilities', type: 'expense', icon: 'bolt', color: '#C9A7FF' },
  { name: 'Health', type: 'expense', icon: 'heart-pulse', color: '#FF9DB0' },
  { name: 'Entertainment', type: 'expense', icon: 'film', color: '#FFB98A' },
  { name: 'Shopping', type: 'expense', icon: 'shirt', color: '#7FE3F0' },
  { name: 'Subscriptions', type: 'expense', icon: 'repeat', color: '#A8E6CF' },
  { name: 'Travel', type: 'expense', icon: 'plane', color: '#8AC8FF' },
  { name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#E2C2FF' },
  { name: 'Other', type: 'expense', icon: 'tag', color: '#A5B5AE' },
];

export async function createStarterCategories(ownerId: Types.ObjectId): Promise<void> {
  await Category.insertMany(
    STARTER_CATEGORIES.map((c) => ({
      ownerId,
      name: c.name,
      nameKey: c.name.toLowerCase(),
      type: c.type,
      icon: c.icon,
      color: c.color,
      isDefault: true,
    })),
  );
}

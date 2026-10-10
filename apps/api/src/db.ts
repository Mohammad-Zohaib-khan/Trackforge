import mongoose from 'mongoose';
import type { MongoClient } from 'mongodb';
import { Budget } from './models/budget.js';
import { Category } from './models/category.js';
import { Transaction } from './models/transaction.js';
import { User } from './models/user.js';

mongoose.set('strictQuery', true);
// Indexes are created explicitly at startup (syncIndexes) rather than lazily.
mongoose.set('autoIndex', false);

export async function connectDatabase(uri: string, maxPoolSize = 20): Promise<MongoClient> {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize,
  });
  await Promise.all([User.createIndexes(), Category.createIndexes(), Transaction.createIndexes(), Budget.createIndexes()]);
  return mongoose.connection.getClient();
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

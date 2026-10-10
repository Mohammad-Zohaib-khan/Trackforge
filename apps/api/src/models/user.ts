import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { DATE_STYLES, LOCALES, SUPPORTED_CURRENCIES, type SafeUser } from '@trackforge/shared';

const preferencesSchema = new Schema(
  {
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true, default: 'USD' },
    locale: { type: String, enum: LOCALES, required: true, default: 'en-US' },
    timeZone: { type: String, required: true, default: 'UTC', maxlength: 64 },
    dateStyle: { type: String, enum: DATE_STYLES, required: true, default: 'medium' },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['active', 'disabled'], required: true, default: 'active' },
    preferences: { type: preferencesSchema, required: true, default: () => ({}) },
  },
  { timestamps: true, strict: 'throw' },
);

userSchema.index({ email: 1 }, { unique: true });

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;
export const User = model('User', userSchema);

export function toSafeUser(user: UserDoc): SafeUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    preferences: {
      currency: user.preferences.currency,
      locale: user.preferences.locale,
      timeZone: user.preferences.timeZone,
      dateStyle: user.preferences.dateStyle,
    },
    createdAt: user.createdAt.toISOString(),
  };
}

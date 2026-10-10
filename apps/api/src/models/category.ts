import { Schema, type Types, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CATEGORY_ICONS, TRANSACTION_TYPES, type CategoryDto } from '@trackforge/shared';

const categorySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    /** Lower-cased name used for case-insensitive uniqueness per owner and type. */
    nameKey: { type: String, required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true, immutable: true },
    icon: { type: String, enum: CATEGORY_ICONS, required: true, default: 'tag' },
    color: { type: String, default: null },
    archived: { type: Boolean, required: true, default: false },
    /** Copied from the starter set at registration; still fully owned by the user. */
    isDefault: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, strict: 'throw' },
);

categorySchema.index({ ownerId: 1, type: 1, nameKey: 1 }, { unique: true });

categorySchema.pre('validate', function setNameKey() {
  if (typeof this.name === 'string') this.nameKey = this.name.trim().toLowerCase();
});

export type CategoryFields = InferSchemaType<typeof categorySchema>;
export type CategoryDoc = HydratedDocument<CategoryFields>;
export const Category = model('Category', categorySchema);

export function toCategoryDto(c: CategoryDoc | (CategoryFields & { _id: Types.ObjectId })): CategoryDto {
  return {
    id: c._id.toString(),
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color ?? null,
    archived: c.archived,
    isDefault: c.isDefault,
  };
}

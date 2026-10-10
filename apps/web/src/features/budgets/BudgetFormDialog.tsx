import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { amountString, minorToDecimalString, objectId, type BudgetDto } from '@trackforge/shared';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useCategories, useCreateBudget, useUpdateBudget } from '../../lib/queries';
import { ApiError, errorMessage } from '../../lib/api';
import { formatMonth } from '../../lib/format';
import { usePrefs } from '../auth/session';

const schema = z.object({
  categoryId: objectId.or(z.literal('')).refine((v) => v !== '', 'Choose a category'),
  amount: amountString,
  warningThresholdPct: z.number().int().min(50).max(100),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  month: string;
  editing: BudgetDto | null;
  existingCategoryIds: string[];
  onClose: () => void;
}

export function BudgetFormDialog({ open, month, editing, existingCategoryIds, onClose }: Props) {
  const prefs = usePrefs();
  const { notify } = useToast();
  const categories = useCategories({ type: 'expense' });
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const available = (categories.data ?? []).filter((c) => !existingCategoryIds.includes(c.id));

  const { register, handleSubmit, watch, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { categoryId: editing.category.id, amount: minorToDecimalString(editing.limitMinor, prefs.currency), warningThresholdPct: editing.warningThresholdPct }
      : { categoryId: '', amount: '', warningThresholdPct: 80 },
  });
  const threshold = watch('warningThresholdPct');

  const onSubmit = async (values: Values) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: { amount: values.amount, warningThresholdPct: values.warningThresholdPct } });
        notify('Budget updated');
      } else {
        await create.mutateAsync({ ...values, month });
        notify('Budget added');
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field === 'categoryId' || field === 'amount' || field === 'warningThresholdPct') setError(field, { message });
        }
      } else {
        notify(errorMessage(err), { tone: 'error' });
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={editing ? `Edit ${editing.category.name} budget` : 'Add budget'}
      description={`For ${formatMonth(month, prefs.locale)}, in ${prefs.currency}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="budget-form" loading={formState.isSubmitting}>
            {editing ? 'Save budget' : 'Add budget'}
          </Button>
        </>
      }
    >
      <form id="budget-form" noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {!editing && (
          <SelectField
            label="Expense category"
            error={formState.errors.categoryId?.message}
            disabled={categories.isPending}
            hint={
              categories.isSuccess && available.length === 0 ? (
                <>
                  Every active expense category already has a budget this month.{' '}
                  <Link to="/app/categories" className="text-mint hover:underline" onClick={onClose}>
                    Add a category
                  </Link>
                </>
              ) : undefined
            }
            {...register('categoryId')}
          >
            <option value="">{categories.isPending ? 'Loading…' : 'Choose a category'}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label="Monthly limit" inputMode="decimal" leading={prefs.currency} className="tabular pl-12" placeholder="0.00" error={formState.errors.amount?.message} {...register('amount')} />
        <div className="flex flex-col gap-2">
          <label htmlFor="threshold" className="flex justify-between text-[13px] font-medium text-muted">
            Warn me at
            <span className="tabular text-ink">{threshold}% of the limit</span>
          </label>
          <input id="threshold" type="range" min={50} max={100} step={5} className="accent-[var(--color-mint)]" {...register('warningThresholdPct', { valueAsNumber: true })} />
        </div>
      </form>
    </Dialog>
  );
}

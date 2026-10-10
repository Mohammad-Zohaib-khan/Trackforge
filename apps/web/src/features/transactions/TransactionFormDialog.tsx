import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type z } from 'zod';
import { Link } from 'react-router';
import {
  PAYMENT_METHODS,
  createTransactionSchema,
  minorToDecimalString,
  type CreateTransactionInput,
  type TransactionDto,
  type TransactionType,
} from '@trackforge/shared';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';
import { useCategories, useCreateTransaction, useUpdateTransaction } from '../../lib/queries';
import { ApiError, errorMessage } from '../../lib/api';
import { PAYMENT_METHOD_LABELS } from '../../lib/format';
import { usePrefs } from '../auth/session';
import { today } from '../../lib/periods';

type FormInput = z.input<typeof createTransactionSchema>;
type FormOutput = z.output<typeof createTransactionSchema>;

interface Props {
  open: boolean;
  editing: TransactionDto | null;
  defaultType: TransactionType;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
] as const;

export function TransactionFormDialog({ open, editing, defaultType, onClose }: Props) {
  const prefs = usePrefs();
  const { notify } = useToast();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const categories = useCategories({ includeArchived: true });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: editing
      ? {
          type: editing.type,
          amount: minorToDecimalString(editing.amountMinor, editing.currency),
          categoryId: editing.category?.id ?? '',
          date: editing.date,
          paymentMethod: editing.paymentMethod,
          merchant: editing.merchant,
          note: editing.note,
          recurring: editing.recurring,
        }
      : {
          type: defaultType,
          amount: '',
          categoryId: '',
          date: today(prefs.timeZone),
          paymentMethod: 'debit_card',
          merchant: '',
          note: '',
          recurring: false,
        },
  });
  const { register, handleSubmit, control, watch, setValue, setError, formState } = form;
  const type = watch('type');
  const selectedCategory = watch('categoryId');

  const options = (categories.data ?? []).filter(
    (c) => c.type === type && (!c.archived || c.id === editing?.category?.id),
  );

  /** Switching type clears a category that belongs to the other type. */
  const changeType = (next: TransactionType) => {
    setValue('type', next);
    const current = (categories.data ?? []).find((c) => c.id === selectedCategory);
    if (current && current.type !== next) setValue('categoryId', '');
  };

  const onSubmit = async (values: CreateTransactionInput) => {
    try {
      const payload = { ...values, merchant: values.merchant ?? '', note: values.note ?? '' };
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: payload });
        notify('Transaction updated');
      } else {
        await create.mutateAsync(payload);
        notify(values.type === 'income' ? 'Income recorded' : 'Expense recorded');
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field in values) setError(field as keyof FormInput, { message });
        }
      } else {
        notify(errorMessage(err), { tone: 'error' });
      }
    }
  };

  const busy = formState.isSubmitting;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      description={`Amounts are in ${prefs.currency}, your account currency.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="transaction-form" loading={busy}>
            {editing ? 'Save changes' : type === 'income' ? 'Add income' : 'Add expense'}
          </Button>
        </>
      }
    >
      <form id="transaction-form" noValidate onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented label="Transaction type" value={field.value} options={TYPE_OPTIONS} onChange={changeType} className="w-fit sm:col-span-2" />
          )}
        />
        <TextField
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          leading={prefs.currency}
          className="tabular pl-12 text-[16px]"
          error={formState.errors.amount?.message}
          {...register('amount')}
        />
        <TextField label="Date" type="date" error={formState.errors.date?.message} {...register('date')} />
        <SelectField
          label="Category"
          error={formState.errors.categoryId?.message}
          hint={
            categories.isSuccess && options.length === 0 ? (
              <>
                No {type} categories yet. <Link to="/app/categories" className="text-mint underline-offset-2 hover:underline" onClick={onClose}>Create one</Link>.
              </>
            ) : undefined
          }
          disabled={categories.isPending}
          {...register('categoryId')}
        >
          <option value="">{categories.isPending ? 'Loading categories…' : 'Choose a category'}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? ' (archived)' : ''}
            </option>
          ))}
        </SelectField>
        <SelectField label="Payment method" error={formState.errors.paymentMethod?.message} {...register('paymentMethod')}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={type === 'income' ? 'Payer' : 'Merchant or payee'}
          optional
          maxLength={80}
          autoComplete="off"
          wrapperClassName="sm:col-span-2"
          error={formState.errors.merchant?.message}
          {...register('merchant')}
        />
        <div className="sm:col-span-2">
          <TextAreaField label="Note" optional maxLength={500} rows={2} error={formState.errors.note?.message} {...register('note')} />
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-[14px] text-muted sm:col-span-2">
          <input type="checkbox" className="size-4 accent-[var(--color-mint)]" {...register('recurring')} />
          This repeats regularly (rent, salary, subscriptions)
        </label>
      </form>
    </Dialog>
  );
}

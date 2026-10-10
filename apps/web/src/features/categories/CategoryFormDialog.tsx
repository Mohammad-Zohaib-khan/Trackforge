import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CATEGORY_ICONS, type CategoryDto, type CategoryIcon as IconId, type TransactionType } from '@trackforge/shared';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { ICONS } from '../../components/ui/CategoryIcon';
import { useToast } from '../../components/ui/Toast';
import { useCreateCategory, useUpdateCategory } from '../../lib/queries';
import { ApiError, errorMessage } from '../../lib/api';
import { cx } from '../../lib/cx';

const COLORS = ['#94FFD1', '#6BF5FF', '#9DB8FF', '#C9A7FF', '#FF9DB0', '#FFB98A', '#F5D27A', '#A8E6CF', '#A5B5AE'] as const;

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40, 'Use 40 characters or fewer'),
  icon: z.enum(CATEGORY_ICONS),
  color: z.string(),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  editing: CategoryDto | null;
  type: TransactionType;
  onClose: () => void;
}

export function CategoryFormDialog({ open, editing, type, onClose }: Props) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const { notify } = useToast();
  const { register, handleSubmit, control, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: editing?.name ?? '', icon: editing?.icon ?? 'tag', color: editing?.color ?? COLORS[0] },
  });

  const onSubmit = async (values: Values) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: values });
        notify('Category saved');
      } else {
        await create.mutateAsync({ ...values, type });
        notify(`${values.name} added`);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'CATEGORY_EXISTS' || err.fields['name'])) {
        setError('name', { message: err.fields['name'] ?? err.message });
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
      title={editing ? 'Edit category' : `New ${type} category`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={formState.isSubmitting}>
            {editing ? 'Save category' : 'Add category'}
          </Button>
        </>
      }
    >
      <form id="category-form" noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <TextField label="Name" maxLength={40} autoComplete="off" error={formState.errors.name?.message} {...register('name')} />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted">Colour</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} checked={field.value === c} onChange={() => field.onChange(c)} className="peer sr-only" />
                    <span
                      className="block size-7 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-mint"
                      style={{ background: c }}
                    />
                    <span className="sr-only">{c}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted">Icon</legend>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
                {CATEGORY_ICONS.map((id: IconId) => {
                  const Icon = ICONS[id];
                  return (
                    <label key={id} className="cursor-pointer" title={id.replace('-', ' ')}>
                      <input type="radio" name="icon" value={id} checked={field.value === id} onChange={() => field.onChange(id)} className="peer sr-only" />
                      <span
                        className={cx(
                          'flex aspect-square items-center justify-center rounded-sm border text-muted transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-mint',
                          field.value === id ? 'border-mint/70 bg-elevated text-mint' : 'border-line hover:border-line-strong hover:text-ink',
                        )}
                      >
                        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="sr-only">{id.replace('-', ' ')}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      </form>
    </Dialog>
  );
}

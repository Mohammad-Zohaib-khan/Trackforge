import { useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { addMonths, type BudgetDto } from '@trackforge/shared';
import { Page } from '../../components/layout/Page';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { DisplayAmount, Money } from '../../components/ui/Money';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Skeleton } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { useBudgets, useCopyBudgets, useDeleteBudget } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { formatBps, formatMonth } from '../../lib/format';
import { currentMonth } from '../../lib/periods';
import { usePrefs } from '../auth/session';
import { BudgetFormDialog } from './BudgetFormDialog';
import { cx } from '../../lib/cx';

const STATUS_TEXT = { on_track: 'On track', warning: 'Near limit', over: 'Over budget' } as const;
const STATUS_CLASS = { on_track: 'text-muted', warning: 'text-warn', over: 'text-over' } as const;

export function BudgetsPage() {
  const prefs = usePrefs();
  const thisMonth = currentMonth(prefs.timeZone);
  const [month, setMonth] = useState(thisMonth);
  const budgets = useBudgets(month);
  const previous = useBudgets(addMonths(month, -1));
  const copy = useCopyBudgets();
  const remove = useDeleteBudget();
  const { notify } = useToast();
  const [form, setForm] = useState<{ open: boolean; editing: BudgetDto | null; session: number }>({ open: false, editing: null, session: 0 });
  const openForm = (editing: BudgetDto | null) => setForm((f) => ({ open: true, editing, session: f.session + 1 }));
  const [deleting, setDeleting] = useState<BudgetDto | null>(null);
  const data = budgets.data;
  const canCopy = data && data.budgets.length === 0 && (previous.data?.budgets.length ?? 0) > 0;

  const copyPrevious = async () => {
    try {
      const res = await copy.mutateAsync({ fromMonth: addMonths(month, -1), toMonth: month });
      notify(res.copied ? `Copied ${res.copied} ${res.copied === 1 ? 'budget' : 'budgets'} from ${formatMonth(addMonths(month, -1), prefs.locale)}` : 'Nothing new to copy');
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      notify(`Removed the ${deleting.category.name} budget`);
      setDeleting(null);
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    }
  };

  const spentShare = data && data.totals.limitMinor > 0 ? Math.round((data.totals.spentMinor * 10_000) / data.totals.limitMinor) : null;

  return (
    <Page
      title="Budgets"
      description="Monthly spending limits by category, measured against what you actually spent."
      actions={
        <>
          <div className="flex items-center rounded-md border border-line bg-sheet/70 backdrop-blur">
            <IconButton label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
              <ChevronLeft className="size-4" aria-hidden />
            </IconButton>
            <label className="sr-only" htmlFor="budget-month">
              Month
            </label>
            <input
              id="budget-month"
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="h-9 w-[150px] bg-transparent px-1 text-center text-[13px] outline-none"
            />
            <IconButton label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="size-4" aria-hidden />
            </IconButton>
          </div>
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openForm(null)}>
            Add budget
          </Button>
        </>
      }
      horizon={
        data && data.budgets.length > 0 ? (
          <div className={cx('flex flex-wrap items-end gap-x-12 gap-y-4', budgets.isPlaceholderData && 'opacity-60')}>
            <div>
              <p className="text-[13px] text-ink/75">{data.totals.remainingMinor >= 0 ? 'Left to spend' : 'Over all budgets by'} in {formatMonth(month, prefs.locale)}</p>
              <DisplayAmount
                minor={Math.abs(data.totals.remainingMinor)}
                label={data.totals.remainingMinor >= 0 ? 'Left to spend' : 'Over budget by'}
                className={cx('mt-1 text-[48px] leading-none tracking-[-0.045em] sm:text-[60px]', data.totals.remainingMinor < 0 && 'text-over')}
              />
            </div>
            <p className="pb-1 text-[14px] text-ink/75">
              <Money minor={data.totals.spentMinor} className="text-ink" /> spent of <Money minor={data.totals.limitMinor} className="text-ink" /> budgeted
              {spentShare !== null && <span className="tabular">{` (${formatBps(spentShare)})`}</span>}
            </p>
          </div>
        ) : undefined
      }
    >
      {budgets.isError ? (
        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} title="Budgets could not load" />
      ) : !data ? (
        <div className="flex flex-col gap-6">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : data.budgets.length === 0 ? (
        <EmptyState
          title={`No budgets for ${formatMonth(month, prefs.locale)}`}
          body="Set a monthly limit for an expense category. TrackForge warns you when spending reaches your threshold and flags anything over the limit."
          action={
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openForm(null)}>
                Add budget
              </Button>
              {canCopy && (
                <Button variant="secondary" icon={<Copy aria-hidden className="size-4" />} loading={copy.isPending} onClick={() => void copyPrevious()}>
                  Copy {formatMonth(addMonths(month, -1), prefs.locale, 'short')}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <ul className={cx('divide-y divide-line', budgets.isPlaceholderData && 'opacity-60')}>
          {data.budgets.map((b) => (
            <li key={b.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 py-5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(200px,0.9fr)_auto]">
              <CategoryIcon icon={b.category.icon} color={b.category.color} />
              <div className="min-w-0">
                <p className="truncate text-[15px] text-ink">
                  {b.category.name}
                  {b.category.archived && <span className="ml-2 text-[12px] text-faint">archived</span>}
                </p>
                <p className={cx('text-[12px]', STATUS_CLASS[b.status])}>
                  {STATUS_TEXT[b.status]}
                  <span className="text-faint">{`, warns at ${b.warningThresholdPct}%`}</span>
                </p>
              </div>
              <div className="col-span-3 flex flex-col gap-2 sm:col-span-1">
                <ProgressBar usedBps={b.usedBps} thresholdPct={b.warningThresholdPct} status={b.status} label={`${b.category.name} budget`} />
                <p className="tabular flex justify-between text-[12px] text-muted">
                  <span>
                    <Money minor={b.spentMinor} className="text-ink" /> of <Money minor={b.limitMinor} />
                  </span>
                  <span className={b.remainingMinor < 0 ? 'text-over' : ''}>
                    {b.remainingMinor < 0 ? (
                      <>
                        <Money minor={-b.remainingMinor} className="text-over" /> over
                      </>
                    ) : (
                      <>
                        <Money minor={b.remainingMinor} /> left
                      </>
                    )}
                  </span>
                </p>
              </div>
              <div className="col-start-3 row-start-1 flex sm:col-start-4">
                <IconButton label={`Edit ${b.category.name} budget`} onClick={() => openForm(b)}>
                  <Pencil className="size-4" aria-hidden />
                </IconButton>
                <IconButton label={`Delete ${b.category.name} budget`} tone="danger" onClick={() => setDeleting(b)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BudgetFormDialog
        key={form.session}
        open={form.open}
        month={month}
        editing={form.editing}
        existingCategoryIds={data?.budgets.map((b) => b.category.id) ?? []}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Remove this budget?"
        body={deleting ? `The ${deleting.category.name} limit for ${formatMonth(month, prefs.locale)} will be removed. Transactions are not affected.` : ''}
        confirmLabel="Remove budget"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Page>
  );
}

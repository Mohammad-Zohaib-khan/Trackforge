import { Pencil, Repeat, Trash2 } from 'lucide-react';
import type { TransactionDto } from '@trackforge/shared';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { IconButton } from '../../components/ui/Button';
import { Money } from '../../components/ui/Money';
import { Skeleton } from '../../components/ui/Spinner';
import { PAYMENT_METHOD_LABELS, formatDate } from '../../lib/format';
import { usePrefs } from '../auth/session';
import { cx } from '../../lib/cx';

interface Props {
  items: TransactionDto[] | undefined;
  loading: boolean;
  stale?: boolean;
  compact?: boolean;
  onEdit?: (tx: TransactionDto) => void;
  onDelete?: (tx: TransactionDto) => void;
}

function signed(tx: TransactionDto): number {
  return tx.type === 'income' ? tx.amountMinor : -tx.amountMinor;
}

function title(tx: TransactionDto): string {
  return tx.merchant || tx.category?.name || (tx.type === 'income' ? 'Income' : 'Expense');
}

export function TransactionTable({ items, loading, stale, compact, onEdit, onDelete }: Props) {
  const prefs = usePrefs();
  const actions = Boolean(onEdit || onDelete);

  if (loading && !items) {
    return (
      <div className="flex flex-col divide-y divide-line" aria-busy>
        {Array.from({ length: compact ? 4 : 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3.5">
            <Skeleton className="size-8" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }
  if (!items) return null;

  return (
    <div className={cx('transition-opacity', stale && 'opacity-60')} aria-busy={stale || undefined}>
      {/* Wide screens: a real table for screen readers and scanning. */}
      <table className={cx('w-full border-collapse text-[14px]', compact ? 'hidden' : 'hidden md:table')}>
        <caption className="sr-only">Transactions</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-faint">
            <th scope="col" className="w-[118px] py-2.5 pr-4 font-medium">Date</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Description</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Category</th>
            <th scope="col" className="hidden py-2.5 pr-4 font-medium lg:table-cell">Method</th>
            <th scope="col" className="py-2.5 pr-2 text-right font-medium">Amount</th>
            {actions && <th scope="col" className="w-[84px] py-2.5"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={tx.id} className="group border-b border-line/70 transition-colors hover:bg-white/[0.02]">
              <td className="tabular whitespace-nowrap py-3 pr-4 text-muted">{formatDate(tx.date, prefs)}</td>
              <td className="max-w-[320px] py-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className="truncate text-ink">{title(tx)}</span>
                  {tx.recurring && <Repeat aria-label="Recurring" className="size-3.5 shrink-0 text-faint" />}
                </div>
                {tx.note && <p className="truncate text-[12px] text-faint">{tx.note}</p>}
              </td>
              <td className="py-3 pr-4">
                <span className="inline-flex items-center gap-2 text-muted">
                  {tx.category && <CategoryIcon icon={tx.category.icon} color={tx.category.color} size="sm" />}
                  <span className="truncate">{tx.category?.name ?? 'Deleted category'}</span>
                </span>
              </td>
              <td className="hidden py-3 pr-4 text-muted lg:table-cell">{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</td>
              <td className="py-3 pr-2 text-right font-medium">
                <Money minor={signed(tx)} sign="always" tone={tx.type === 'income' ? 'income' : 'expense'} />
              </td>
              {actions && (
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    {onEdit && (
                      <IconButton label={`Edit ${title(tx)}`} onClick={() => onEdit(tx)}>
                        <Pencil className="size-4" aria-hidden />
                      </IconButton>
                    )}
                    {onDelete && (
                      <IconButton label={`Delete ${title(tx)}`} tone="danger" onClick={() => onDelete(tx)}>
                        <Trash2 className="size-4" aria-hidden />
                      </IconButton>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Narrow screens (and compact lists): stacked rows. */}
      <ul className={cx('divide-y divide-line/70', compact ? '' : 'md:hidden')}>
        {items.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            {tx.category ? <CategoryIcon icon={tx.category.icon} color={tx.category.color} /> : <span className="size-8" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-ink">{title(tx)}</p>
              <p className="tabular truncate text-[12px] text-faint">
                {formatDate(tx.date, prefs)}
                {tx.category && <span className="text-faint">{`, ${tx.category.name}`}</span>}
              </p>
            </div>
            <Money minor={signed(tx)} sign="always" tone={tx.type === 'income' ? 'income' : 'expense'} className="text-[14px] font-medium" />
            {actions && (
              <div className="flex">
                {onEdit && (
                  <IconButton label={`Edit ${title(tx)}`} onClick={() => onEdit(tx)}>
                    <Pencil className="size-4" aria-hidden />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton label={`Delete ${title(tx)}`} tone="danger" onClick={() => onDelete(tx)}>
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

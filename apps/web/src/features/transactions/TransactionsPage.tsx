import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Download, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { PAYMENT_METHODS, type TransactionDto, type TransactionType } from '@trackforge/shared';
import { Page } from '../../components/layout/Page';
import { Button } from '../../components/ui/Button';
import { compactControl } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { useCategories, useCreateTransaction, useDeleteTransaction, useTransactions, type TransactionQuery } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { PAYMENT_METHOD_LABELS } from '../../lib/format';
import { useDebounced } from '../../lib/useDebounced';
import { minorToDecimalString } from '@trackforge/shared';
import { useTransactionComposer } from './composer';
import { TransactionTable } from './TransactionTable';
import { usePrefs } from '../auth/session';
import { resolvePeriod } from '../../lib/periods';
import { useCsvExport } from '../reports/useCsvExport';
import { cx } from '../../lib/cx';

const SORTS = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'amount:desc', label: 'Largest amount' },
  { value: 'amount:asc', label: 'Smallest amount' },
  { value: 'merchant:asc', label: 'Merchant A–Z' },
] as const;

const FILTER_KEYS = ['q', 'type', 'categoryId', 'paymentMethod', 'from', 'to', 'minAmount', 'maxAmount'] as const;
const PAGE_SIZE = 20;

export function TransactionsPage() {
  const prefs = usePrefs();
  const [params, setParams] = useSearchParams();
  const composer = useTransactionComposer();
  const { notify } = useToast();
  const remove = useDeleteTransaction();
  const restore = useCreateTransaction();
  const exporter = useCsvExport();
  const categories = useCategories({ includeArchived: true });
  const [pendingDelete, setPendingDelete] = useState<TransactionDto | null>(null);
  const [showMore, setShowMore] = useState(() => ['paymentMethod', 'minAmount', 'maxAmount'].some((k) => params.get(k)));
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(search.trim());

  const get = (key: string) => params.get(key) ?? '';
  const update = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };

  // Push the debounced search text into the URL once per change. setParams changes identity on
  // every navigation, so the ref guard keeps this from re-running into a navigation loop.
  const lastPushed = useRef(debouncedSearch);
  useEffect(() => {
    if (lastPushed.current === debouncedSearch) return;
    lastPushed.current = debouncedSearch;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) next.set('q', debouncedSearch);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch, setParams]);

  const [sort, order] = (get('sort') || 'date:desc').split(':') as [NonNullable<TransactionQuery['sort']>, 'asc' | 'desc'];
  const page = Math.max(1, Number(get('page')) || 1);
  const query: TransactionQuery = {
      q: get('q') || undefined,
      type: (get('type') || undefined) as TransactionType | undefined,
      categoryId: get('categoryId') || undefined,
      paymentMethod: get('paymentMethod') || undefined,
      from: get('from') || undefined,
      to: get('to') || undefined,
      minAmount: get('minAmount') || undefined,
      maxAmount: get('maxAmount') || undefined,
      sort,
      order,
      page,
      pageSize: PAGE_SIZE,
  };
  const list = useTransactions(query);
  const activeFilters = FILTER_KEYS.filter((k) => get(k)).length;
  const typeFilter = get('type') as TransactionType | '';
  const categoryOptions = (categories.data ?? []).filter((c) => !typeFilter || c.type === typeFilter);

  const clearFilters = () => {
    setSearch('');
    const next = new URLSearchParams();
    if (get('sort')) next.set('sort', get('sort'));
    setParams(next, { replace: true });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const tx = pendingDelete;
    try {
      await remove.mutateAsync(tx.id);
      setPendingDelete(null);
      notify('Transaction deleted', {
        action: tx.category
          ? {
              label: 'Undo',
              onClick: () => {
                restore.mutate(
                  {
                    type: tx.type,
                    amount: minorToDecimalString(tx.amountMinor, tx.currency),
                    categoryId: tx.category?.id ?? '',
                    date: tx.date,
                    paymentMethod: tx.paymentMethod,
                    merchant: tx.merchant,
                    note: tx.note,
                    recurring: tx.recurring,
                  },
                  {
                    onSuccess: () => notify('Transaction restored'),
                    onError: (err) => notify(errorMessage(err), { tone: 'error' }),
                  },
                );
              },
            }
          : undefined,
      });
    } catch (err) {
      notify(errorMessage(err), { tone: 'error' });
    }
  };

  const exportCurrent = () => {
    const fallback = resolvePeriod('last_12_months', prefs.timeZone);
    void exporter.run({
      from: get('from') || fallback.from,
      to: get('to') || fallback.to,
      type: (get('type') || undefined) as TransactionType | undefined,
      categoryId: get('categoryId') || undefined,
    });
  };

  const total = list.data?.total;

  return (
    <Page
      title="Transactions"
      description={
        total === undefined
          ? 'Every income and expense you have recorded.'
          : activeFilters
            ? `${total.toLocaleString(prefs.locale)} ${total === 1 ? 'transaction matches' : 'transactions match'} your filters.`
            : `${total.toLocaleString(prefs.locale)} ${total === 1 ? 'transaction' : 'transactions'} recorded.`
      }
      actions={
        <>
          <Button
            variant="secondary"
            icon={<Download aria-hidden className="size-4" />}
            loading={exporter.pending}
            onClick={exportCurrent}
            title={get('from') || get('to') ? 'Export the filtered date range' : 'Exports the last 12 months unless you set dates'}
          >
            Export CSV
          </Button>
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => composer.open()}>
            Add transaction
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <label htmlFor="tx-search" className="sr-only">
              Search merchant or note
            </label>
            <input
              id="tx-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant or note"
              maxLength={80}
              className={cx(compactControl, 'pl-9')}
            />
          </div>
          <FilterSelect label="Type" value={get('type')} onChange={(v) => update({ type: v, categoryId: '' })}>
            <option value="">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
          </FilterSelect>
          <FilterSelect label="Category" value={get('categoryId')} onChange={(v) => update({ categoryId: v })}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ' (archived)' : ''}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort" value={`${sort}:${order}`} onChange={(v) => update({ sort: v === 'date:desc' ? '' : v }, false)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
          <Button
            variant={showMore ? 'secondary' : 'ghost'}
            size="sm"
            className="h-9"
            aria-expanded={showMore}
            aria-controls="more-filters"
            icon={<SlidersHorizontal aria-hidden className="size-4" />}
            onClick={() => setShowMore((v) => !v)}
          >
            More filters
          </Button>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-9" icon={<X aria-hidden className="size-4" />} onClick={clearFilters}>
              Clear {activeFilters}
            </Button>
          )}
        </div>

        {showMore && (
          <div id="more-filters" className="grid grid-cols-2 gap-2 rounded-md border border-line bg-surface/60 p-3 sm:grid-cols-3 lg:grid-cols-5">
            <DateFilter label="From" value={get('from')} onChange={(v) => update({ from: v })} />
            <DateFilter label="To" value={get('to')} onChange={(v) => update({ to: v })} />
            <AmountFilter label={`Min amount (${prefs.currency})`} value={get('minAmount')} onCommit={(v) => update({ minAmount: v })} />
            <AmountFilter label={`Max amount (${prefs.currency})`} value={get('maxAmount')} onCommit={(v) => update({ maxAmount: v })} />
            <FilterSelect label="Payment method" stacked value={get('paymentMethod')} onChange={(v) => update({ paymentMethod: v })}>
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </FilterSelect>
          </div>
        )}
      </div>

      <div className="mt-6">
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Transactions could not load" />
        ) : list.data && list.data.total === 0 ? (
          activeFilters ? (
            <EmptyState
              title="Nothing matches these filters"
              body="Try a wider date range or a different category."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Your ledger is empty"
              body="Record your first income or expense. Totals, budgets and reports are all calculated from what you enter here."
              action={
                <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => composer.open()}>
                  Add transaction
                </Button>
              }
            />
          )
        ) : (
          <>
            <TransactionTable
              items={list.data?.items}
              loading={list.isPending}
              stale={list.isPlaceholderData}
              onEdit={(tx) => composer.open({ edit: tx })}
              onDelete={setPendingDelete}
            />
            {list.data && (
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                pageSize={list.data.pageSize}
                onChange={(p) => update({ page: p > 1 ? String(p) : '' }, false)}
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this transaction?"
        body="Totals, budgets and reports will update straight away. You can undo from the confirmation message."
        confirmLabel="Delete transaction"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </Page>
  );
}

function FilterSelect({ label, value, onChange, children, stacked }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; stacked?: boolean }) {
  return (
    <label className={cx('flex', stacked ? 'flex-col gap-1 text-[12px] text-faint' : 'items-center')}>
      <span className={stacked ? '' : 'sr-only'}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(compactControl, 'w-auto cursor-pointer pr-8')}>
        {children}
      </select>
    </label>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-faint">
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={compactControl} />
    </label>
  );
}

function AmountFilter({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const valid = draft === '' || /^\d{1,10}(\.\d{1,2})?$/.test(draft);
  return (
    <label className="flex flex-col gap-1 text-[12px] text-faint">
      {label}
      <input
        inputMode="decimal"
        value={draft}
        aria-invalid={!valid || undefined}
        onChange={(e) => setDraft(e.target.value.trim())}
        onBlur={() => valid && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onCommit(draft);
        }}
        className={cx(compactControl, 'tabular', !valid && 'border-over/60')}
      />
    </label>
  );
}

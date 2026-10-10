import { useState, type FormEvent } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { budgetProgress, parseAmountToMinor, summarizeTotals, type CategoryIcon as IconId, type TransactionType } from '@trackforge/shared';
import { Button, IconButton } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Money } from '../../components/ui/Money';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Segmented } from '../../components/ui/Segmented';
import { compactControl } from '../../components/ui/Field';
import { formatBps } from '../../lib/format';
import { cx } from '../../lib/cx';

/**
 * A browser-only sandbox. It uses the same exact-money parser, totals and budget
 * functions as the API, so visitors see the real rules at work. Nothing is sent
 * to the server or stored.
 */

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: IconId;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#94FFD1' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'wallet', color: '#6BF5FF' },
  { id: 'groceries', name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#94FFD1' },
  { id: 'dining', name: 'Dining', type: 'expense', icon: 'utensils', color: '#F5D27A' },
  { id: 'transport', name: 'Transport', type: 'expense', icon: 'car', color: '#9DB8FF' },
];

interface Entry {
  id: number;
  type: TransactionType;
  minor: number;
  categoryId: string;
}

const START: Entry[] = [
  { id: 1, type: 'income', minor: 320_000, categoryId: 'salary' },
  { id: 2, type: 'expense', minor: 21_480, categoryId: 'groceries' },
  { id: 3, type: 'expense', minor: 4_250, categoryId: 'dining' },
];

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
] as const;

const BUDGET_CATEGORY = 'groceries';

export function LedgerSandbox() {
  const [entries, setEntries] = useState<Entry[]>(START);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('groceries');
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(30_000);
  const [threshold, setThreshold] = useState(80);
  const nextId = entries.reduce((m, e) => Math.max(m, e.id), 0) + 1;

  const totals = summarizeTotals(
    (['income', 'expense'] as const).map((t) => ({
      type: t,
      totalMinor: entries.filter((e) => e.type === t).reduce((s, e) => s + e.minor, 0),
      count: entries.filter((e) => e.type === t).length,
    })),
  );
  const groceriesSpent = entries.filter((e) => e.categoryId === BUDGET_CATEGORY).reduce((s, e) => s + e.minor, 0);
  const budget = budgetProgress(groceriesSpent, limit, threshold);
  const options = CATEGORIES.filter((c) => c.type === type);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmountToMinor(amount, 'USD');
    if (!parsed.ok) {
      setError(parsed.reason === 'precision' ? 'Two decimal places at most' : parsed.reason === 'range' ? 'Enter more than zero' : 'Try a number like 42 or 42.50');
      return;
    }
    setEntries((all) => [{ id: nextId, type, minor: parsed.minor, categoryId }, ...all].slice(0, 8));
    setAmount('');
    setError(null);
  };

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(CATEGORIES.find((c) => c.type === next)?.id ?? '');
  };

  return (
    <div className="grid gap-px overflow-hidden rounded-[20px] border border-line bg-line lg:grid-cols-[1.05fr_1fr]">
      {/* Entry side */}
      <div className="flex flex-col gap-5 bg-surface p-5 sm:p-7">
        <form onSubmit={add} className="flex flex-col gap-3" aria-label="Add a sample entry">
          <Segmented label="Sample entry type" value={type} options={TYPE_OPTIONS} onChange={changeType} className="w-fit" />
          <div className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Amount (USD)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-invalid={Boolean(error) || undefined}
                className={cx(compactControl, 'tabular h-10 text-[15px]', error && 'border-over/60')}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Category
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cx(compactControl, 'h-10 cursor-pointer')}>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="col-span-2 self-end sm:col-span-1">
              Add
            </Button>
          </div>
          <p role={error ? 'alert' : undefined} className={cx('min-h-4 text-[12px]', error ? 'text-over' : 'text-faint')}>
            {error ?? 'Try 0.10 then 0.20, or 12.345, to see the exact decimal rules.'}
          </p>
        </form>

        <ul className="flex flex-col divide-y divide-line/70" aria-label="Sample entries">
          {entries.map((e) => {
            const cat = CATEGORIES.find((c) => c.id === e.categoryId);
            return (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                {cat && <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
                <span className="flex-1 text-[14px] text-ink">{cat?.name}</span>
                <Money minor={e.type === 'income' ? e.minor : -e.minor} sign="always" tone={e.type === 'income' ? 'income' : 'expense'} className="text-[14px]" />
                <IconButton label={`Remove ${cat?.name ?? 'entry'}`} tone="danger" onClick={() => setEntries((all) => all.filter((x) => x.id !== e.id))}>
                  <Trash2 aria-hidden className="size-3.5" />
                </IconButton>
              </li>
            );
          })}
          {entries.length === 0 && <li className="py-6 text-[14px] text-muted">No entries. Add one above.</li>}
        </ul>
      </div>

      {/* Result side */}
      <div className="flex flex-col gap-6 bg-sheet p-5 sm:p-7" aria-live="polite">
        <div>
          <p className="text-[12px] text-muted">Net cash flow</p>
          <p className={cx('tabular mt-1 text-[44px] font-light leading-none tracking-[-0.04em]', totals.netMinor < 0 && 'text-over')}>
            <Money minor={totals.netMinor} className={totals.netMinor < 0 ? 'text-over' : ''} />
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
            <div>
              <dt className="text-faint">Income</dt>
              <dd><Money minor={totals.incomeMinor} tone="income" /></dd>
            </div>
            <div>
              <dt className="text-faint">Spending</dt>
              <dd><Money minor={totals.expenseMinor} /></dd>
            </div>
            <div>
              <dt className="text-faint">Savings rate</dt>
              <dd className="tabular">{formatBps(totals.savingsRateBps)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2.5">
            <CategoryIcon icon="shopping-cart" color="#94FFD1" size="sm" />
            <span className="flex-1 text-[14px]">Groceries budget</span>
            <span className={cx('text-[12px]', budget.status === 'over' ? 'text-over' : budget.status === 'warning' ? 'text-warn' : 'text-muted')}>
              {budget.status === 'over' ? 'Over budget' : budget.status === 'warning' ? 'Near limit' : 'On track'}
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar usedBps={budget.usedBps} thresholdPct={threshold} status={budget.status} label="Sample groceries budget" />
          </div>
          <p className="tabular mt-2 flex justify-between text-[12px] text-muted">
            <span>
              <Money minor={groceriesSpent} className="text-ink" /> of <Money minor={limit} />
            </span>
            <span>{formatBps(budget.usedBps)}</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-[12px] text-muted">
              <span className="flex justify-between">
                Limit <Money minor={limit} className="text-ink" />
              </span>
              <input type="range" min={10_000} max={60_000} step={1_000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="accent-[var(--color-mint)]" />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] text-muted">
              <span className="flex justify-between">
                Warn at <span className="tabular text-ink">{threshold}%</span>
              </span>
              <input type="range" min={50} max={100} step={5} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="accent-[var(--color-mint)]" />
            </label>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 text-[12px] text-faint">
          <span>Runs in your browser. Nothing is sent or saved.</span>
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw aria-hidden className="size-3.5" />}
            onClick={() => {
              setEntries(START);
              setLimit(30_000);
              setThreshold(80);
              setError(null);
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

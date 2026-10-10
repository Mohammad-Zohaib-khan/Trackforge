import { Suspense, lazy, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Minus } from 'lucide-react';
import { MAX_EXPORT_ROWS, MAX_RANGE_DAYS, addMonths, inclusiveDayCount, type ComparisonRow, type TransactionType } from '@trackforge/shared';
import { Page, Section } from '../../components/layout/Page';
import { Button, IconButton } from '../../components/ui/Button';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Money } from '../../components/ui/Money';
import { Segmented } from '../../components/ui/Segmented';
import { Skeleton } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { SelectField, TextField } from '../../components/ui/Field';
import { useCategories, useComparison, useTrend } from '../../lib/queries';
import { formatBps, formatMoney, formatMonth } from '../../lib/format';
import { currentMonth, resolvePeriod } from '../../lib/periods';
import { usePrefs } from '../auth/session';
import { useCsvExport } from './useCsvExport';
import { cx } from '../../lib/cx';

const CashFlowChart = lazy(() => import('../dashboard/CashFlowChart'));
const WINDOWS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
] as const;

export function ReportsPage() {
  const prefs = usePrefs();
  const [month, setMonth] = useState(() => currentMonth(prefs.timeZone));
  const comparison = useComparison(month);
  const c = comparison.data;

  return (
    <Page
      title="Reports"
      description="Month-over-month comparison, longer trends and exports, all from your recorded transactions."
      actions={
        <div className="flex items-center rounded-md border border-line bg-sheet/70 backdrop-blur">
          <IconButton label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="size-4" aria-hidden />
          </IconButton>
          <label className="sr-only" htmlFor="report-month">
            Report month
          </label>
          <input id="report-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-[150px] bg-transparent px-1 text-center text-[13px] outline-none" />
          <IconButton label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="size-4" aria-hidden />
          </IconButton>
        </div>
      }
      horizon={
        <div className={cx('grid gap-3 sm:grid-cols-3', comparison.isPlaceholderData && 'opacity-60')}>
          <CompareStat label="Income" current={c?.current.incomeMinor} previous={c?.previous.incomeMinor} changeBps={c?.change.incomeBps} goodWhen="up" />
          <CompareStat label="Spending" current={c?.current.expenseMinor} previous={c?.previous.expenseMinor} changeBps={c?.change.expenseBps} goodWhen="down" />
          <CompareStat label="Net cash flow" current={c?.current.netMinor} previous={c?.previous.netMinor} deltaMinor={c?.change.netMinor} goodWhen="up" />
        </div>
      }
    >
      <div className="flex flex-col gap-14">
        <Section title={`By category, ${formatMonth(month, prefs.locale)} vs ${formatMonth(addMonths(month, -1), prefs.locale)}`}>
          {comparison.isError ? (
            <ErrorState error={comparison.error} onRetry={() => void comparison.refetch()} />
          ) : !c ? (
            <Skeleton className="h-48 w-full" />
          ) : c.categories.length === 0 ? (
            <p className="text-[14px] text-muted">No transactions in either month.</p>
          ) : (
            <ComparisonTable rows={c.categories} />
          )}
        </Section>
        <TrendSection />
        <ExportSection />
      </div>
    </Page>
  );
}

function CompareStat({
  label,
  current,
  previous,
  changeBps,
  deltaMinor,
  goodWhen,
}: {
  label: string;
  current: number | undefined;
  previous: number | undefined;
  changeBps?: number | null | undefined;
  deltaMinor?: number | undefined;
  goodWhen: 'up' | 'down';
}) {
  const prefs = usePrefs();
  if (current === undefined || previous === undefined) {
    return <Skeleton className="h-[104px] w-full rounded-lg" />;
  }
  const delta = deltaMinor ?? current - previous;
  const improving = delta === 0 ? null : (delta > 0) === (goodWhen === 'up');
  return (
    <div className="rounded-lg border border-line bg-sheet/65 px-5 py-4 backdrop-blur-md">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-light leading-tight tracking-[-0.03em]">
        <Money minor={current} />
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
        <ChangeIcon delta={delta} improving={improving} />
        <span className="tabular">
          {changeBps !== undefined ? (changeBps === null ? 'No prior data' : formatBps(changeBps, { sign: true })) : formatMoney(delta, prefs, { sign: 'always' })}
        </span>
        <span className="text-faint">vs last month</span>
      </p>
    </div>
  );
}

function ChangeIcon({ delta, improving }: { delta: number; improving: boolean | null }) {
  const cls = cx('size-3.5', improving === null ? 'text-faint' : improving ? 'text-mint' : 'text-over');
  if (delta > 0) return <ArrowUpRight aria-hidden className={cls} />;
  if (delta < 0) return <ArrowDownRight aria-hidden className={cls} />;
  return <Minus aria-hidden className={cls} />;
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const groups: Array<{ type: TransactionType; label: string }> = [
    { type: 'expense', label: 'Spending' },
    { type: 'income', label: 'Income' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[14px]">
        <caption className="sr-only">Category totals compared with the previous month</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-faint">
            <th scope="col" className="py-2.5 pr-4 font-medium">Category</th>
            <th scope="col" className="py-2.5 pr-4 text-right font-medium">Previous</th>
            <th scope="col" className="py-2.5 pr-4 text-right font-medium">This month</th>
            <th scope="col" className="py-2.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        {groups.map((g) => {
          const items = rows.filter((r) => r.type === g.type);
          if (items.length === 0) return null;
          return (
            <tbody key={g.type}>
              <tr>
                <th scope="rowgroup" colSpan={4} className="pb-1 pt-5 text-left text-[13px] font-medium text-muted">
                  {g.label}
                </th>
              </tr>
              {items.map((r) => {
                const delta = r.currentMinor - r.previousMinor;
                const improving = delta === 0 ? null : (delta > 0) === (r.type === 'income');
                return (
                  <tr key={`${r.type}-${r.categoryId}`} className="border-b border-line/60">
                    <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon icon={r.icon} color={null} size="sm" />
                        {r.name}
                      </span>
                    </th>
                    <td className="py-2.5 pr-4 text-right text-muted">
                      <Money minor={r.previousMinor} />
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Money minor={r.currentMinor} />
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-muted">
                        <ChangeIcon delta={delta} improving={improving} />
                        <span className="tabular">{r.changeBps === null ? 'New' : formatBps(r.changeBps, { sign: true })}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function TrendSection() {
  const prefs = usePrefs();
  const [windowSize, setWindowSize] = useState<'6' | '12' | '24'>('12');
  const [showTable, setShowTable] = useState(false);
  const to = currentMonth(prefs.timeZone);
  const from = addMonths(to, -(Number(windowSize) - 1));
  const trend = useTrend(from, to);
  const t = trend.data;

  return (
    <Section
      title="Trend"
      description={`${formatMonth(from, prefs.locale)} to ${formatMonth(to, prefs.locale)}`}
      actions={<Segmented label="Trend window" value={windowSize} options={WINDOWS} onChange={setWindowSize} />}
    >
      {trend.isError ? (
        <ErrorState error={trend.error} onRetry={() => void trend.refetch()} />
      ) : !t ? (
        <Skeleton className="h-[320px] w-full" />
      ) : (
        <div className={cx('flex flex-col gap-6', trend.isPlaceholderData && 'opacity-60')}>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <TrendStat label="Total income" value={<Money minor={t.totals.incomeMinor} tone="income" />} />
            <TrendStat label="Total spending" value={<Money minor={t.totals.expenseMinor} />} />
            <TrendStat label="Net" value={<Money minor={t.totals.netMinor} sign="always" />} />
            <TrendStat label="Average monthly spending" value={<Money minor={t.averageMonthlyExpenseMinor} />} />
          </dl>
          <Suspense fallback={<Skeleton className="h-[296px] w-full" />}>
            <CashFlowChart series={t.series} height={280} />
          </Suspense>
          <div>
            <Button variant="ghost" size="sm" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Hide data table' : 'Show as a table'}
            </Button>
            {showTable && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-[13px]">
                  <caption className="sr-only">Monthly income, spending and net</caption>
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-faint">
                      <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Income</th>
                      <th scope="col" className="py-2 pr-4 text-right font-medium">Spending</th>
                      <th scope="col" className="py-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.series.map((p) => (
                      <tr key={p.month} className="border-b border-line/60">
                        <th scope="row" className="py-2 pr-4 text-left font-normal text-muted">{formatMonth(p.month, prefs.locale)}</th>
                        <td className="py-2 pr-4 text-right"><Money minor={p.incomeMinor} /></td>
                        <td className="py-2 pr-4 text-right"><Money minor={p.expenseMinor} /></td>
                        <td className="py-2 text-right"><Money minor={p.netMinor} sign="always" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function TrendStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-medium">{value}</dd>
    </div>
  );
}

function ExportSection() {
  const prefs = usePrefs();
  const initial = resolvePeriod('last_12_months', prefs.timeZone);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [type, setType] = useState<'' | TransactionType>('');
  const [categoryId, setCategoryId] = useState('');
  const categories = useCategories({ includeArchived: true });
  const exporter = useCsvExport();
  const error = !from || !to ? 'Choose both dates' : from > to ? 'Start date must be before the end date' : inclusiveDayCount(from, to) > MAX_RANGE_DAYS ? 'Exports cover at most 3 years at a time' : null;

  return (
    <Section
      title="Export transactions"
      description={`CSV for spreadsheets. Up to ${MAX_EXPORT_ROWS.toLocaleString(prefs.locale)} rows and 3 years per file. Cells that could run as spreadsheet formulas are escaped.`}
    >
      <form
        className="grid gap-4 rounded-lg border border-line bg-surface/50 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) void exporter.run({ from, to, type: type || undefined, categoryId: categoryId || undefined });
        }}
      >
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} error={error ?? undefined} />
        <SelectField
          label="Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as '' | TransactionType);
            setCategoryId('');
          }}
        >
          <option value="">All</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </SelectField>
        <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {(categories.data ?? [])
            .filter((cat) => !type || cat.type === type)
            .map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
        </SelectField>
        <Button type="submit" icon={<Download aria-hidden className="size-4" />} loading={exporter.pending} disabled={Boolean(error)}>
          Download CSV
        </Button>
      </form>
    </Section>
  );
}

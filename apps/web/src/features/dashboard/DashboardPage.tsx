import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Plus, TriangleAlert } from 'lucide-react';
import { Page, Section } from '../../components/layout/Page';
import { DisplayAmount, Money } from '../../components/ui/Money';
import { PeriodPicker } from '../../components/ui/PeriodPicker';
import { Skeleton } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useDashboard } from '../../lib/queries';
import { formatBps, formatDate, formatMonth } from '../../lib/format';
import { PERIOD_LABELS, resolvePeriod, type Period } from '../../lib/periods';
import { useSession } from '../auth/session';
import { useTransactionComposer } from '../transactions/composer';
import { TransactionTable } from '../transactions/TransactionTable';
import { CategoryBreakdown } from './CategoryBreakdown';
import { cx } from '../../lib/cx';

const CashFlowChart = lazy(() => import('./CashFlowChart'));

export function DashboardPage() {
  const { user, prefs } = useSession();
  const composer = useTransactionComposer();
  const [period, setPeriod] = useState<Period>(() => resolvePeriod('this_month', prefs.timeZone));
  const dash = useDashboard(period.from, period.to);
  const data = dash.data;
  const firstName = user?.name.split(' ')[0] ?? '';
  const rangeLabel =
    period.key === 'custom' ? `${formatDate(period.from, prefs)} to ${formatDate(period.to, prefs)}` : PERIOD_LABELS[period.key].toLowerCase();

  return (
    <Page
      title={firstName ? `Hello, ${firstName}` : 'Overview'}
      description="Calculated from the transactions you have recorded."
      actions={<PeriodPicker value={period} timeZone={prefs.timeZone} onChange={setPeriod} />}
      horizon={
        <div className={cx('grid gap-6 transition-opacity lg:grid-cols-[1fr_auto] lg:items-end', dash.isPlaceholderData && 'opacity-60')}>
          <div>
            <p className="text-[13px] text-ink/75">Net cash flow, {rangeLabel}</p>
            {data ? (
              <DisplayAmount minor={data.totals.netMinor} label="Net cash flow" className="mt-1 text-[52px] leading-none tracking-[-0.045em] sm:text-[72px]" />
            ) : (
              <Skeleton className="mt-3 h-14 w-72" />
            )}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-sheet/60 backdrop-blur-md">
            <Stat label="Income" value={data ? <Money minor={data.totals.incomeMinor} tone="income" /> : null} />
            <Stat label="Spending" value={data ? <Money minor={data.totals.expenseMinor} /> : null} />
            <Stat
              label="Savings rate"
              value={data ? <span className="tabular">{formatBps(data.totals.savingsRateBps)}</span> : null}
              hint={data && data.totals.savingsRateBps === null ? 'No income yet' : undefined}
            />
          </dl>
        </div>
      }
    >
      {dash.isError ? (
        <ErrorState error={dash.error} onRetry={() => void dash.refetch()} title="Your overview could not load" />
      ) : data && data.totals.transactionCount === 0 && data.trend.every((p) => p.incomeMinor === 0 && p.expenseMinor === 0) ? (
        <EmptyState
          title="Nothing recorded yet"
          body="Add your income and spending to see cash flow, savings rate, category breakdown and budget alerts here. Every figure on this page is calculated from what you enter."
          action={
            <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => composer.open()}>
              Add your first transaction
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-12">
          <Section title="Monthly cash flow" description="The 12 months ending with the selected period.">
            {data ? (
              <Suspense fallback={<Skeleton className="h-[296px] w-full" />}>
                <CashFlowChart series={data.trend} />
              </Suspense>
            ) : (
              <Skeleton className="h-[296px] w-full" />
            )}
          </Section>

          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <Section
              title="Where the money went"
              description={data ? `${data.totals.transactionCount} ${data.totals.transactionCount === 1 ? 'transaction' : 'transactions'} in this period` : undefined}
            >
              {!data ? (
                <div className="flex flex-col gap-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : data.expenseByCategory.length === 0 ? (
                <p className="text-[14px] text-muted">No spending in this period.</p>
              ) : (
                <CategoryBreakdown slices={data.expenseByCategory} from={period.from} to={period.to} />
              )}
            </Section>

            <div className="flex flex-col gap-12">
              <Section
                title="Budget alerts"
                description={data ? formatMonth(data.budgetMonth, prefs.locale) : undefined}
                actions={
                  <Link to="/app/budgets" className="text-[13px] text-mint underline-offset-4 hover:underline">
                    All budgets
                  </Link>
                }
              >
                {!data ? (
                  <Skeleton className="h-16 w-full" />
                ) : data.budgetAlerts.length === 0 ? (
                  <p className="text-[14px] text-muted">Every budget for this month is on track.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {data.budgetAlerts.map((b) => (
                      <li key={b.id} className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <CategoryIcon icon={b.category.icon} color={b.category.color} size="sm" />
                          <span className="flex-1 truncate text-[14px]">{b.category.name}</span>
                          <span className={cx('inline-flex items-center gap-1.5 text-[12px]', b.status === 'over' ? 'text-over' : 'text-warn')}>
                            <TriangleAlert aria-hidden className="size-3.5" />
                            {b.status === 'over' ? 'Over budget' : `${formatBps(b.usedBps)} used`}
                          </span>
                        </div>
                        <ProgressBar usedBps={b.usedBps} thresholdPct={b.warningThresholdPct} status={b.status} label={`${b.category.name} budget`} />
                        <p className="tabular text-[12px] text-faint">
                          <Money minor={b.spentMinor} className="text-muted" /> of <Money minor={b.limitMinor} className="text-muted" />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Latest in this period"
                actions={
                  <Link to={`/app/transactions?from=${period.from}&to=${period.to}`} className="text-[13px] text-mint underline-offset-4 hover:underline">
                    View all
                  </Link>
                }
              >
                {data && data.recent.length === 0 ? (
                  <p className="text-[14px] text-muted">No transactions in this period.</p>
                ) : (
                  <TransactionTable items={data?.recent} loading={!data} compact />
                )}
              </Section>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string | undefined }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:min-w-[150px] sm:px-5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="truncate text-[16px] font-medium sm:text-[18px]">{value ?? <Skeleton className="h-5 w-20" />}</dd>
      {hint && <dd className="text-[11px] text-faint">{hint}</dd>}
    </div>
  );
}

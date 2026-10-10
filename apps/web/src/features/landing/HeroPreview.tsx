import { motion, useReducedMotion } from 'motion/react';
import { TriangleAlert } from 'lucide-react';
import { budgetProgress, summarizeTotals } from '@trackforge/shared';
import { DisplayAmount, Money } from '../../components/ui/Money';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { formatBps } from '../../lib/format';

/**
 * A miniature overview assembled from the app's own components and calculation
 * functions, fed with a small, clearly labelled example month.
 */
const EXAMPLE = {
  income: 520_000,
  rows: [
    { name: 'Housing', icon: 'home', color: '#6BF5FF', minor: 145_000 },
    { name: 'Groceries', icon: 'shopping-cart', color: '#94FFD1', minor: 48_230 },
    { name: 'Dining', icon: 'utensils', color: '#F5D27A', minor: 21_460 },
    { name: 'Transport', icon: 'car', color: '#9DB8FF', minor: 12_890 },
  ] as const,
  months: [62, 71, 58, 66, 74, 69],
};

export function HeroPreview() {
  const reduce = useReducedMotion();
  const spending = EXAMPLE.rows.reduce((s, r) => s + r.minor, 0);
  const totals = summarizeTotals([
    { type: 'income', totalMinor: EXAMPLE.income, count: 1 },
    { type: 'expense', totalMinor: spending, count: 18 },
  ]);
  const groceries = budgetProgress(48_230, 52_000, 80);
  const max = Math.max(...EXAMPLE.rows.map((r) => r.minor));

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
      className="relative w-full max-w-[460px]"
      aria-label="Example overview built from TrackForge components"
      role="img"
    >
      <div className="overflow-hidden rounded-[20px] border border-line-strong bg-sheet/92 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.95)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="text-[12px] text-muted">Overview, this month</span>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">Example data</span>
        </div>

        <div className="px-5 pb-5 pt-4">
          <p className="text-[12px] text-muted">Net cash flow</p>
          <DisplayAmount minor={totals.netMinor} label="Example net cash flow" className="text-[46px] leading-none tracking-[-0.045em]" />

          <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg border border-line">
            <div className="px-3 py-2.5">
              <dt className="text-[11px] text-faint">Income</dt>
              <dd className="text-[14px] font-medium"><Money minor={totals.incomeMinor} tone="income" /></dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="text-[11px] text-faint">Spending</dt>
              <dd className="text-[14px] font-medium"><Money minor={totals.expenseMinor} /></dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="text-[11px] text-faint">Saved</dt>
              <dd className="tabular text-[14px] font-medium">{formatBps(totals.savingsRateBps)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex h-14 items-end gap-1.5" aria-hidden>
            {EXAMPLE.months.map((h, i) => (
              <span
                key={i}
                className={i === EXAMPLE.months.length - 1 ? 'flex-1 rounded-t-[4px] bg-chart-income' : 'flex-1 rounded-t-[4px] bg-white/[0.09]'}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          <ul className="mt-5 flex flex-col gap-2.5">
            {EXAMPLE.rows.map((r) => (
              <li key={r.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1">
                <CategoryIcon icon={r.icon} color={r.color} size="sm" />
                <span className="text-[13px] text-ink">{r.name}</span>
                <Money minor={r.minor} className="text-[13px]" />
                <span className="col-start-2 col-end-4 h-[3px] rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-chart-income" style={{ width: `${(r.minor / max) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg border border-warn/25 bg-[#1b170c] px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-ink">Groceries budget</span>
              <span className="inline-flex items-center gap-1 text-warn">
                <TriangleAlert aria-hidden className="size-3" />
                {formatBps(groceries.usedBps)} used
              </span>
            </div>
            <ProgressBar usedBps={groceries.usedBps} thresholdPct={80} status={groceries.status} label="Example groceries budget" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

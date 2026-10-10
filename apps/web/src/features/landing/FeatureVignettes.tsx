import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { budgetProgress, changeBps } from '@trackforge/shared';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Money } from '../../components/ui/Money';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatBps } from '../../lib/format';
import { csvPreviewCell } from './csvPreview';

/** Small, static demonstrations of each capability, drawn with the real UI components. */

export function TraceVignette() {
  return (
    <div className="rounded-lg border border-line bg-surface/70 p-4">
      <div className="flex items-center justify-between text-[13px]">
        <span className="inline-flex items-center gap-2">
          <CategoryIcon icon="utensils" color="#F5D27A" size="sm" />
          Dining, March
        </span>
        <Money minor={8_960} className="font-medium" />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 border-l border-line pl-4 text-[12px] text-muted">
        <li className="flex justify-between"><span>Mar 4, Harbor Grill</span><Money minor={-4_210} sign="always" /></li>
        <li className="flex justify-between"><span>Mar 12, Noodle bar</span><Money minor={-1_850} sign="always" /></li>
        <li className="flex justify-between"><span>Mar 27, Café</span><Money minor={-2_900} sign="always" /></li>
      </ul>
    </div>
  );
}

const BUDGET_STATES = [
  { name: 'Transport', icon: 'car', color: '#9DB8FF', spent: 9_200, limit: 18_000 },
  { name: 'Groceries', icon: 'shopping-cart', color: '#94FFD1', spent: 43_100, limit: 50_000 },
  { name: 'Dining', icon: 'utensils', color: '#F5D27A', spent: 27_400, limit: 25_000 },
] as const;

export function BudgetVignette() {
  return (
    <ul className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface/70 p-4">
      {BUDGET_STATES.map((b) => {
        const p = budgetProgress(b.spent, b.limit, 80);
        return (
          <li key={b.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[13px]">
              <CategoryIcon icon={b.icon} color={b.color} size="sm" />
              <span className="flex-1">{b.name}</span>
              <span className={p.status === 'over' ? 'text-[12px] text-over' : p.status === 'warning' ? 'text-[12px] text-warn' : 'text-[12px] text-muted'}>
                {p.status === 'over' ? 'Over budget' : p.status === 'warning' ? 'Near limit' : 'On track'}
              </span>
            </div>
            <ProgressBar usedBps={p.usedBps} thresholdPct={80} status={p.status} label={`${b.name} example budget`} />
          </li>
        );
      })}
    </ul>
  );
}

const COMPARE = [
  { name: 'Groceries', icon: 'shopping-cart', color: '#94FFD1', prev: 38_460, cur: 31_040 },
  { name: 'Utilities', icon: 'bolt', color: '#C9A7FF', prev: 13_934, cur: 16_358 },
] as const;

export function ReportVignette() {
  return (
    <div className="rounded-lg border border-line bg-surface/70 p-4">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2.5 text-[13px]">
        <span className="text-[11px] text-faint">Category</span>
        <span className="text-right text-[11px] text-faint">This month</span>
        <span className="text-right text-[11px] text-faint">Change</span>
        {COMPARE.map((r) => {
          const bps = changeBps(r.prev, r.cur);
          const down = r.cur < r.prev;
          return (
            <div key={r.name} className="contents">
              <span className="inline-flex items-center gap-2">
                <CategoryIcon icon={r.icon} color={r.color} size="sm" />
                {r.name}
              </span>
              <Money minor={r.cur} className="text-right" />
              <span className="tabular inline-flex items-center justify-end gap-1 text-muted">
                {down ? <ArrowDownRight aria-hidden className="size-3.5 text-mint" /> : <ArrowUpRight aria-hidden className="size-3.5 text-over" />}
                {formatBps(bps, { sign: true })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExportVignette() {
  const rows = [
    ['Date', 'Category', 'Amount', 'Merchant / payee'],
    ['2026-03-04', 'Dining', '42.10', 'Harbor Grill'],
    ['2026-03-09', 'Other', '18.00', '=HYPERLINK("http://x")'],
  ];
  return (
    <figure className="m-0 rounded-lg border border-line bg-[#060908] p-4">
      <pre className="tabular overflow-x-auto text-[12px] leading-6 text-muted">
        {rows.map((r) => r.map(csvPreviewCell).join(',')).join('\n')}
      </pre>
      <figcaption className="mt-2 text-[12px] text-faint">The formula in the last row is written as text, so a spreadsheet never runs it.</figcaption>
    </figure>
  );
}

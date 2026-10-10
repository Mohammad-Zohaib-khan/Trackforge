import type { BudgetStatus } from '@trackforge/shared';
import { cx } from '../../lib/cx';

const fill: Record<BudgetStatus, string> = {
  on_track: 'bg-mint',
  warning: 'bg-warn',
  over: 'bg-over',
};

/** Budget meter: fill caps at 100%; overspend shows as a full red bar plus the threshold tick. */
export function ProgressBar({ usedBps, thresholdPct, status, label }: { usedBps: number; thresholdPct: number; status: BudgetStatus; label: string }) {
  const pct = Math.min(100, Math.max(0, usedBps / 100));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(usedBps / 100, 999))}
      aria-valuetext={`${(usedBps / 100).toFixed(0)}% used`}
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out-soft', fill[status])} style={{ width: `${pct}%` }} />
      <div aria-hidden className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${thresholdPct}%` }} />
    </div>
  );
}

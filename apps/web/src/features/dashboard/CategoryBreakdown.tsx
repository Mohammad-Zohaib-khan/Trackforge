import { Link } from 'react-router';
import type { CategorySlice } from '@trackforge/shared';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { Money } from '../../components/ui/Money';
import { formatBps } from '../../lib/format';

const MAX_ROWS = 7;

/**
 * Spending by category as a ranked bar list: one measure, one hue, labels in ink.
 * Categories beyond the top rows fold into "Everything else".
 */
export function CategoryBreakdown({ slices, from, to }: { slices: CategorySlice[]; from: string; to: string }) {
  const top = slices.slice(0, MAX_ROWS);
  const rest = slices.slice(MAX_ROWS);
  const restTotal = rest.reduce((s, r) => s + r.totalMinor, 0);
  const restShare = rest.reduce((s, r) => s + r.shareBps, 0);
  const max = Math.max(...slices.map((s) => s.totalMinor), 1);

  return (
    <ul className="flex flex-col gap-3.5">
      {top.map((s) => (
        <li key={s.categoryId ?? s.name}>
          <Link
            to={`/app/transactions?type=expense&from=${from}&to=${to}${s.categoryId ? `&categoryId=${s.categoryId}` : ''}`}
            className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-sm"
            aria-label={`${s.name}: ${formatBps(s.shareBps)} of spending. View transactions`}
          >
            <CategoryIcon icon={s.icon} color={s.color} size="sm" />
            <span className="truncate text-[14px] text-ink group-hover:text-mint">{s.name}</span>
            <span className="text-[14px]">
              <Money minor={s.totalMinor} />
              <span className="tabular ml-2 inline-block w-12 text-right text-[12px] text-faint">{formatBps(s.shareBps)}</span>
            </span>
            <span className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-chart-income" style={{ width: `${(s.totalMinor / max) * 100}%` }} />
            </span>
          </Link>
        </li>
      ))}
      {rest.length > 0 && (
        <li className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 text-[14px] text-muted">
          <span className="size-6" />
          <span>Everything else ({rest.length})</span>
          <span>
            <Money minor={restTotal} />
            <span className="tabular ml-2 inline-block w-12 text-right text-[12px] text-faint">{formatBps(restShare)}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

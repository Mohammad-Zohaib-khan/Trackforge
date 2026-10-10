import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from 'recharts';
import type { MonthlyPoint } from '@trackforge/shared';
import { formatMoney, formatMonth, formatMonthShort } from '../../lib/format';
import { usePrefs } from '../auth/session';

const INCOME = 'var(--color-chart-income)';
const EXPENSE = 'var(--color-chart-expense)';

/**
 * Monthly income vs spending: two series on one shared axis (same unit), a legend,
 * a hover tooltip with net, and a text summary for screen readers.
 */
export default function CashFlowChart({ series, height = 260 }: { series: MonthlyPoint[]; height?: number }) {
  const prefs = usePrefs();
  const data = series.map((p) => ({ ...p, label: formatMonthShort(p.month, prefs.locale) }));
  const hasData = series.some((p) => p.incomeMinor > 0 || p.expenseMinor > 0);

  const busiest = [...series].sort((a, b) => b.expenseMinor - a.expenseMinor)[0];
  const summary = hasData
    ? `Monthly income and spending from ${formatMonth(series[0]?.month ?? '', prefs.locale)} to ${formatMonth(series.at(-1)?.month ?? '', prefs.locale)}. Highest spending was ${formatMoney(busiest?.expenseMinor ?? 0, prefs)} in ${formatMonth(busiest?.month ?? '', prefs.locale)}.`
    : 'No income or spending recorded in this window yet.';

  return (
    <figure className="m-0">
      <div className="mb-3 flex items-center gap-5 text-[12px] text-muted">
        <LegendSwatch color={INCOME} label="Income" />
        <LegendSwatch color={EXPENSE} label="Spending" />
      </div>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--color-faint)', fontSize: 12 }} dy={6} interval="preserveStartEnd" />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-faint)', fontSize: 12 }}
              tickFormatter={(v: number) => formatMoney(v, prefs, { compact: true })}
            />
            <Tooltip cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} content={(props) => <CashFlowTooltip {...props} />} />
            <Bar dataKey="incomeMinor" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="expenseMinor" name="Spending" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function CashFlowTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const prefs = usePrefs();
  const point = payload?.[0]?.payload as (MonthlyPoint & { label: string }) | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-line-strong bg-elevated px-3 py-2.5 text-[12px] shadow-[0_12px_32px_-8px_rgb(0_0_0/0.9)]">
      <p className="mb-1.5 font-medium text-ink">{formatMonth(point.month, prefs.locale)}</p>
      <dl className="tabular grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-[2px]" style={{ background: INCOME }} />
          Income
        </dt>
        <dd className="text-right text-ink">{formatMoney(point.incomeMinor, prefs)}</dd>
        <dt className="flex items-center gap-1.5 text-muted">
          <span className="size-2 rounded-[2px]" style={{ background: EXPENSE }} />
          Spending
        </dt>
        <dd className="text-right text-ink">{formatMoney(point.expenseMinor, prefs)}</dd>
        <dt className="pt-1 text-muted">Net</dt>
        <dd className="pt-1 text-right font-medium text-ink">{formatMoney(point.netMinor, prefs, { sign: 'always' })}</dd>
      </dl>
    </div>
  );
}

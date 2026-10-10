import { useState } from 'react';
import { MAX_RANGE_DAYS, inclusiveDayCount } from '@trackforge/shared';
import { PERIOD_LABELS, resolvePeriod, type Period, type PeriodKey } from '../../lib/periods';
import { compactControl } from './Field';
import { Button } from './Button';
import { cx } from '../../lib/cx';

const PRESETS: Array<Exclude<PeriodKey, 'custom'>> = ['this_month', 'last_month', 'last_3_months', 'year_to_date', 'last_12_months'];

interface Props {
  value: Period;
  timeZone: string;
  onChange: (period: Period) => void;
}

export function PeriodPicker({ value, timeZone, onChange }: Props) {
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const custom = value.key === 'custom';
  const draftError =
    draft.from > draft.to
      ? 'Start must be before end'
      : inclusiveDayCount(draft.from, draft.to) > MAX_RANGE_DAYS
        ? 'Choose 3 years or less'
        : null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[12px] text-muted">
        Period
        <select
          className={cx(compactControl, 'w-auto min-w-[160px] cursor-pointer bg-sheet/70 backdrop-blur')}
          value={value.key}
          onChange={(e) => {
            const key = e.target.value as PeriodKey;
            if (key === 'custom') onChange({ key, from: value.from, to: value.to });
            else onChange(resolvePeriod(key, timeZone));
            setDraft({ from: value.from, to: value.to });
          }}
        >
          {[...PRESETS, 'custom' as const].map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {custom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftError) onChange({ key: 'custom', ...draft });
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            From
            <input type="date" required value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={cx(compactControl, 'bg-sheet/70')} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-muted">
            To
            <input type="date" required value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={cx(compactControl, 'bg-sheet/70')} />
          </label>
          <Button type="submit" size="sm" variant="secondary" className="h-9" disabled={Boolean(draftError) || !draft.from || !draft.to}>
            Apply
          </Button>
          {draftError && (
            <p role="alert" className="w-full text-[12px] text-over">
              {draftError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

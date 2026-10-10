import { cx } from '../../lib/cx';
import { formatMoney, moneyParts } from '../../lib/format';
import { usePrefs } from '../../features/auth/session';

interface MoneyProps {
  minor: number;
  sign?: 'auto' | 'always' | 'never';
  tone?: 'auto' | 'neutral' | 'income' | 'expense';
  className?: string;
}

/** Inline amount with tabular figures. Income reads mint; spending stays neutral with a true minus. */
export function Money({ minor, sign = 'auto', tone = 'neutral', className }: MoneyProps) {
  const prefs = usePrefs();
  const resolvedTone = tone === 'auto' ? (minor < 0 ? 'expense' : 'income') : tone;
  return (
    <span
      className={cx(
        'tabular whitespace-nowrap',
        resolvedTone === 'income' && 'text-mint',
        resolvedTone === 'expense' && 'text-ink',
        className,
      )}
    >
      {formatMoney(minor, prefs, { sign })}
    </span>
  );
}

/** Large display figure: light weight, decimals de-emphasised. Used once per page in the horizon. */
export function DisplayAmount({ minor, className, label }: { minor: number; className?: string; label: string }) {
  const prefs = usePrefs();
  const { symbol, whole, fraction, negative } = moneyParts(minor, prefs);
  return (
    <p className={cx('tabular font-light text-ink', className)} aria-label={`${label}: ${formatMoney(minor, prefs)}`}>
      <span aria-hidden>
        {negative && <span className="mr-1">{'−'}</span>}
        <span className="mr-1 align-[0.32em] text-[0.42em] font-normal text-muted">{symbol}</span>
        {whole}
        <span className="text-[0.5em] font-normal text-muted">{fraction}</span>
      </span>
    </p>
  );
}

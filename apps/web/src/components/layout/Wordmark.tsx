import { Link } from 'react-router';
import { cx } from '../../lib/cx';

export function Wordmark({ className, to = '/' }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cx('inline-flex items-center gap-2.5 text-ink', className)} aria-label="TrackForge home">
      <svg viewBox="0 0 28 20" className="h-5 w-7" aria-hidden>
        <path d="M2 14c3.5-5 7-5 10.5 0S19.5 19 24 13" fill="none" stroke="var(--color-mint)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M2 7c3.5-5 7-5 10.5 0S19.5 12 24 6" fill="none" stroke="var(--color-cyan)" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="text-[16px] font-semibold tracking-[-0.02em]">TrackForge</span>
    </Link>
  );
}

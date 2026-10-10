import { cx } from '../../lib/cx';

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-muted">
      <WaveMark className="h-6 w-14" />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

/** Two offset strokes echoing the water plane; animates gently unless reduced motion is set. */
export function WaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 24" aria-hidden className={cx('overflow-visible', className)}>
      <path d="M2 16c6-8 12-8 18 0s12 8 18 0 12-8 16-2" fill="none" stroke="var(--color-mint)" strokeWidth="2.4" strokeLinecap="round" className="animate-pulse" />
      <path d="M2 8c6-8 12-8 18 0s12 8 18 0 12-8 16-2" fill="none" stroke="var(--color-cyan)" strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-sm bg-white/[0.05]', className)} />;
}

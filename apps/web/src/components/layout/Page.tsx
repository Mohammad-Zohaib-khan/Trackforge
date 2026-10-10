import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../../lib/cx';

interface PageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Optional large figure or summary shown on the water, above the sheet. */
  horizon?: ReactNode;
  children: ReactNode;
}

/**
 * Every signed-in page has two layers: a transparent horizon over the water
 * plane (title + the page's key figure) and an opaque sheet holding the data.
 * The sheet rising over the water is the one orchestrated motion per route.
 */
export function Page({ title, description, actions, horizon, children }: PageProps) {
  const reduce = useReducedMotion();
  useEffect(() => {
    document.title = `${title} — TrackForge`;
  }, [title]);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh">
      <section className="px-4 pb-7 pt-7 sm:px-8 lg:px-12 lg:pb-10 lg:pt-12">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] sm:text-[30px]">{title}</h1>
              {description && <p className="mt-1.5 max-w-xl text-[14px] text-ink/75">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {horizon}
        </div>
      </section>
      <motion.div
        initial={reduce ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="sheet flex-1 rounded-t-[22px] px-4 pb-16 pt-6 sm:px-8 lg:px-12 lg:pt-9"
      >
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </motion.div>
    </div>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex flex-col gap-4', className)} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

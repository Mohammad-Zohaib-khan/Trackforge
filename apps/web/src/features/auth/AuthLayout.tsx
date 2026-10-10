import { useEffect, type ReactNode } from 'react';
import { Wordmark } from '../../components/layout/Wordmark';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — TrackForge`;
  }, [title]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(440px,520px)]">
      <div className="hidden flex-col justify-between p-10 lg:flex">
        <Wordmark />
        <p className="max-w-[460px] text-[34px] font-light leading-[1.12] tracking-[-0.035em] text-ink">
          Income, spending and budgets, worked out from your own entries.
        </p>
      </div>
      <main className="flex flex-col bg-sheet px-6 py-8 shadow-[-1px_0_0_0_rgb(190_225_210/0.14)] sm:px-12 lg:py-10">
        <Wordmark className="lg:hidden" />
        <div className="my-auto w-full max-w-[400px] self-center py-12">
          <h1 className="text-[28px] font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-[14px] text-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}

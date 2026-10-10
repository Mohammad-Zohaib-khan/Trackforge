import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Wordmark } from '../../components/layout/Wordmark';
import { ButtonLink } from '../../components/ui/Button';
import { useSession } from '../auth/session';
import { HeroPreview } from './HeroPreview';
import { LedgerSandbox } from './LedgerSandbox';
import { BudgetVignette, ExportVignette, ReportVignette, TraceVignette } from './FeatureVignettes';

const FEATURES: Array<{ title: string; body: string; visual: ReactNode }> = [
  {
    title: 'Every figure traces back to an entry',
    body: 'Net cash flow, savings rate, trends and category totals are calculated on the server from the transactions you record. Open any category to see the entries behind its number.',
    visual: <TraceVignette />,
  },
  {
    title: 'Budgets that warn before they break',
    body: 'Set a monthly limit per expense category and choose when to be warned, from half-way to the limit itself. Overspending is flagged on your overview as soon as it happens.',
    visual: <BudgetVignette />,
  },
  {
    title: 'Month against month, category by category',
    body: 'See what changed since last month and by how much, or step back across 6, 12 or 24 months with totals, averages and a plain data table.',
    visual: <ReportVignette />,
  },
  {
    title: 'Exports that are safe to open',
    body: 'Download any range as CSV. Cells that a spreadsheet could run as a formula are escaped, and exports are size-limited and scoped to your account only.',
    visual: <ExportVignette />,
  },
];

export function LandingPage() {
  const { status } = useSession();
  const reduce = useReducedMotion();
  const authed = status === 'authenticated';

  useEffect(() => {
    document.title = 'TrackForge — a calm ledger for your own money';
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-2">
          {authed ? (
            <ButtonLink to="/app" size="sm">
              Open your ledger
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm" className="text-ink/85!">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Create account
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1240px] items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:min-h-[calc(100dvh-80px)] lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-4">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h1 className="text-[44px] font-light leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px] lg:text-[76px]">
              A calm ledger
              <br />
              for your own money.
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-ink/80">
              Record income and spending, set monthly budgets by category, and see how each month compares with the last. Every number is worked out from what you enter.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink to={authed ? '/app' : '/register'} size="lg">
                {authed ? 'Open your ledger' : 'Create your ledger'}
              </ButtonLink>
              <a
                href="#try-it"
                className="inline-flex h-12 items-center rounded-md border border-line bg-sheet/60 px-6 text-[15px] font-medium text-ink backdrop-blur-md transition-colors hover:border-line-strong"
              >
                Try it without an account
              </a>
            </div>
          </motion.div>
          <div className="flex justify-center lg:justify-end">
            <HeroPreview />
          </div>
        </section>

        <div className="sheet rounded-t-[28px]">
          <section id="try-it" aria-labelledby="try-heading" className="mx-auto max-w-[1240px] scroll-mt-6 px-5 pb-8 pt-16 sm:px-8 sm:pt-24">
            <div className="mb-10 grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-end">
              <h2 id="try-heading" className="text-[30px] font-light leading-tight tracking-[-0.03em] sm:text-[40px]">
                Add a few entries and watch the totals.
              </h2>
              <p className="max-w-[460px] text-[15px] text-muted">
                This sandbox runs the same exact-decimal parsing, totals and budget rules as your real ledger. Move the limit or the warning point to see a budget change state.
              </p>
            </div>
            <LedgerSandbox />
          </section>

          <section aria-labelledby="features-heading" className="mx-auto max-w-[1240px] px-5 pb-20 pt-20 sm:px-8 sm:pt-28">
            <h2 id="features-heading" className="max-w-[640px] text-[30px] font-light leading-tight tracking-[-0.03em] sm:text-[40px]">
              Built for keeping an honest record, not for selling you anything.
            </h2>
            <div className="mt-14 grid gap-x-16 gap-y-16 md:grid-cols-2">
              {FEATURES.map((f) => (
                <article key={f.title} className="flex flex-col gap-5 border-t border-line pt-6">
                  <div>
                    <h3 className="text-[17px] font-medium tracking-[-0.01em] text-ink">{f.title}</h3>
                    <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-muted">{f.body}</p>
                  </div>
                  {f.visual}
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="privacy-heading" className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
            <div className="grid gap-8 rounded-[20px] border border-line bg-surface/60 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 id="privacy-heading" className="text-[22px] font-medium tracking-[-0.02em]">
                  Your ledger stays yours.
                </h2>
                <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-muted">
                  Server-side sessions in HttpOnly cookies, Argon2id password hashing, and every query scoped to your account. TrackForge never connects to your bank: balances are what you enter, not bank-verified figures.
                </p>
              </div>
              <ButtonLink to={authed ? '/app' : '/register'} size="lg">
                {authed ? 'Open your ledger' : 'Create your ledger'}
              </ButtonLink>
            </div>
          </section>

          <footer className="px-5 pb-10 sm:px-8">
            <div className="mx-auto flex max-w-[1176px] flex-col gap-3 border-t border-line pt-8 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between">
              <Wordmark className="opacity-80" />
              <p className="max-w-[640px]">TrackForge is a personal record-keeping tool. It does not hold money, move money, or give financial advice.</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

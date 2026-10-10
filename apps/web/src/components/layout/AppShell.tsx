import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { ArrowLeftRight, ChartColumn, LayoutDashboard, LogOut, Menu, PiggyBank, Plus, Settings, Tags } from 'lucide-react';
import { useSession } from '../../features/auth/session';
import { TransactionComposerProvider, useTransactionComposer } from '../../features/transactions/composer';
import { Wordmark } from './Wordmark';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { cx } from '../../lib/cx';
import { useToast } from '../ui/Toast';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/app/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/app/reports', label: 'Reports', icon: ChartColumn },
  { to: '/app/categories', label: 'Categories', icon: Tags },
  { to: '/app/settings', label: 'Settings', icon: Settings },
] as const;

const MOBILE_PRIMARY = NAV.slice(0, 4);
const MOBILE_MORE = NAV.slice(4);

export function AppShell() {
  return (
    <TransactionComposerProvider>
      <ShellLayout />
    </TransactionComposerProvider>
  );
}

function ShellLayout() {
  const { user, logout } = useSession();
  const composer = useTransactionComposer();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      notify('Sign-out could not reach the server. Your local session was cleared.', { tone: 'error' });
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only z-50 rounded-sm bg-mint px-3 py-2 text-[#03140d] focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-sheet/95 px-4 pb-5 pt-6 lg:flex">
        <Wordmark className="px-2" />
        <Button className="mt-8 w-full" icon={<Plus aria-hidden className="size-4" />} onClick={() => composer.open()}>
          Add transaction
        </Button>
        <nav aria-label="Main" className="mt-6 flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors',
                  isActive ? 'bg-elevated text-ink' : 'text-muted hover:bg-white/[0.03] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden className={cx('absolute -left-4 h-5 w-[3px] rounded-r-full bg-mint transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                  <item.icon aria-hidden className={cx('size-[18px]', isActive ? 'text-mint' : 'text-faint group-hover:text-muted')} strokeWidth={1.75} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate px-3 text-[13px] text-ink">{user?.name}</p>
          <p className="truncate px-3 text-[12px] text-faint">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" loading={signingOut} icon={<LogOut aria-hidden className="size-4" />} onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-sheet/90 px-4 backdrop-blur-md lg:hidden">
        <Wordmark />
        <Button size="sm" icon={<Plus aria-hidden className="size-4" />} onClick={() => composer.open()}>
          Add
        </Button>
      </header>

      <main id="main" className="min-w-0 pb-24 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        {MOBILE_PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', isActive ? 'text-mint' : 'text-faint')}
          >
            <item.icon aria-hidden className="size-5" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-faint">
          <Menu aria-hidden className="size-5" strokeWidth={1.75} />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <div className="flex flex-col gap-1">
          {MOBILE_MORE.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-[15px] text-ink hover:bg-white/[0.04]">
              <item.icon aria-hidden className="size-5 text-faint" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
          <button type="button" onClick={signOut} className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] text-muted hover:bg-white/[0.04]">
            <LogOut aria-hidden className="size-5 text-faint" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </Dialog>
    </div>
  );
}

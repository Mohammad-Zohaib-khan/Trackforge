import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import { Outlet, RouterProvider, createBrowserRouter, isRouteErrorResponse, useLocation, useRouteError, ScrollRestoration, type RouteObject } from 'react-router';
import { MotionConfig } from 'motion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { SessionProvider } from '../features/auth/session';
import { RedirectIfAuthed, RequireAuth } from '../features/auth/guards';
import { ToastProvider } from '../components/ui/Toast';
import { ShaderBackground } from '../components/background/ShaderBackground';
import { FullPageLoader } from '../components/ui/Spinner';
import { ButtonLink } from '../components/ui/Button';
import { Wordmark } from '../components/layout/Wordmark';
import { LandingPage } from '../features/landing/LandingPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AppShell } from '../components/layout/AppShell';

// Signed-in pages are split so the public pages load without chart and form code.
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() => import('../features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const BudgetsPage = lazy(() => import('../features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const CategoriesPage = lazy(() => import('../features/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

/** Root layout: one background layer for the entire app, never re-created between routes. */
function Root() {
  const { pathname } = useLocation();
  const mode = pathname.startsWith('/app') ? 'app' : 'hero';
  return (
    <>
      <ShaderBackground mode={mode} />
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageLoader label="Loading" />}>{children}</Suspense>;
}

function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="flex min-h-dvh flex-col items-start justify-center gap-5 px-6 sm:px-16">
      <Wordmark />
      <h1 className="text-[36px] font-light tracking-[-0.03em]">{notFound ? 'This page does not exist' : 'Something broke on this page'}</h1>
      <p className="max-w-md text-muted">{notFound ? 'Check the address, or head back to your overview.' : 'Reload to try again. Your data is safe on the server.'}</p>
      <ButtonLink to="/app">Go to overview</ButtonLink>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-start justify-center gap-5 px-6 sm:px-16">
      <Wordmark />
      <h1 className="text-[36px] font-light tracking-[-0.03em]">This page does not exist</h1>
      <p className="max-w-md text-muted">Check the address, or head back to the start.</p>
      <ButtonLink to="/">Back to TrackForge</ButtonLink>
    </div>
  );
}

/** Route tree, shared by the browser router and the in-browser preview build. */
export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        element: <RedirectIfAuthed />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/app',
            element: <AppShell />,
            children: [
              { index: true, element: <Lazy><DashboardPage /></Lazy> },
              { path: 'transactions', element: <Lazy><TransactionsPage /></Lazy> },
              { path: 'budgets', element: <Lazy><BudgetsPage /></Lazy> },
              { path: 'reports', element: <Lazy><ReportsPage /></Lazy> },
              { path: 'categories', element: <Lazy><CategoriesPage /></Lazy> },
              { path: 'settings', element: <Lazy><SettingsPage /></Lazy> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

type AppRouter = ReturnType<typeof createBrowserRouter>;
let browserRouter: AppRouter | null = null;

export function App({ router }: { router?: AppRouter }) {
  const [activeRouter] = useState<AppRouter>(() => router ?? (browserRouter ??= createBrowserRouter(routes)));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  const motionConfig = useMemo(() => ({ reducedMotion: 'user' as const }), []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig {...motionConfig}>
        <ToastProvider>
          <SessionProvider>
            <RouterProvider router={activeRouter} />
          </SessionProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

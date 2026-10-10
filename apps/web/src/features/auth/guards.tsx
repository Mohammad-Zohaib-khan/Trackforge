import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from './session';
import { FullPageLoader } from '../../components/ui/Spinner';

export function RequireAuth() {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Opening your ledger" />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const { status } = useSession();
  if (status === 'loading') return <FullPageLoader label="Checking your session" />;
  if (status === 'authenticated') return <Navigate to="/app" replace />;
  return <Outlet />;
}

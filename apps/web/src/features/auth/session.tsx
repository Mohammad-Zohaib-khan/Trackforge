import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, SafeUser } from '@trackforge/shared';
import { api, setCsrfToken, setUnauthenticatedHandler } from '../../lib/api';
import type { FormatPrefs } from '../../lib/format';

interface SessionResponse {
  user: SafeUser;
  csrfToken: string;
}

interface SessionContextValue {
  user: SafeUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  prefs: FormatPrefs & { timeZone: string };
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: SafeUser) => void;
  rotateCsrf: (token: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
export const SESSION_KEY = ['session'] as const;

async function fetchSession(): Promise<SafeUser | null> {
  const data = await api.get<SessionResponse | { user: null }>('/auth/session');
  if (data.user && 'csrfToken' in data) {
    setCsrfToken(data.csrfToken);
    return data.user;
  }
  setCsrfToken(null);
  return null;
}

const FALLBACK_PREFS: FormatPrefs & { timeZone: string } = {
  currency: 'USD',
  locale: 'en-US',
  dateStyle: 'medium',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60_000, retry: 1 });

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setCsrfToken(null);
      // Drop all cached financial data the moment the server says the session is gone.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
      queryClient.setQueryData(SESSION_KEY, null);
    });
  }, [queryClient]);

  const establish = useCallback(
    (data: SessionResponse) => {
      setCsrfToken(data.csrfToken);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] });
      queryClient.setQueryData(SESSION_KEY, data.user);
    },
    [queryClient],
  );

  const login = useCallback(async (input: LoginInput) => establish(await api.post<SessionResponse>('/auth/login', input)), [establish]);
  const register = useCallback(
    async (input: RegisterInput) => establish(await api.post<SessionResponse>('/auth/register', input)),
    [establish],
  );
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(SESSION_KEY, null);
    }
  }, [queryClient]);
  const updateUser = useCallback((user: SafeUser) => queryClient.setQueryData(SESSION_KEY, user), [queryClient]);

  const user = query.data ?? null;
  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status: query.isPending ? 'loading' : user ? 'authenticated' : 'anonymous',
      prefs: user ? { ...user.preferences } : FALLBACK_PREFS,
      login,
      register,
      logout,
      updateUser,
      rotateCsrf: setCsrfToken,
    }),
    [user, query.isPending, login, register, logout, updateUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Shortcut for components that are only rendered for signed-in users. */
export function usePrefs() {
  return useSession().prefs;
}

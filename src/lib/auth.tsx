import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { post, refreshSession, SessionUser, setAccessToken, setOnSessionLost } from './api';

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  /** Crea una cuenta nueva en la Lotería (misma API) y abre su sesión. */
  register: (body: Record<string, unknown>) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Sesión compartida con la Lotería: se entra con la misma cuenta. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    setOnSessionLost(() => {
      setAccessToken(null);
      setUser(null);
    });
    refreshSession()
      .then((s) => setUser(s?.user ?? null))
      .finally(() => setReady(true));
  }, []);

  const start = useCallback(
    (s: { accessToken: string; user: SessionUser }) => {
      setAccessToken(s.accessToken);
      qc.clear();
      setUser(s.user);
      return s.user;
    },
    [qc],
  );

  const value: AuthState = {
    user,
    ready,
    login: async (email, password) => start(await post('/auth/login', { email, password })),
    register: async (body) => start(await post('/auth/register', body)),
    logout: async () => {
      await post('/auth/logout').catch(() => undefined);
      setAccessToken(null);
      qc.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

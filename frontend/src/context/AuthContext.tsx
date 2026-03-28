import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api, ApiError, type AuthUser, type MeResponse } from '../api/client';

interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  meData: MeResponse | null;
}

interface SignupOptions {
  name?: string;
  school?: string;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, options?: SignupOptions) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    meData: null,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setState({ loading: false, user: data.user, meData: data });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState({ loading: false, user: null, meData: null });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setState({ loading: false, user: res.user, meData: null });
    await refresh();
  };

  const signup = async (email: string, password: string, options?: SignupOptions) => {
    const res = await api.signup(email, password);
    setState({ loading: false, user: res.user, meData: null });
    if (options?.name || options?.school) {
      try {
        await api.setupProfile({
          name: options.name ?? '',
          school: options.school ?? '',
          major: '',
          year: 'freshman',
          bio: '',
          subjects: [],
        });
      } catch {
        // partial profile is fine, user will complete it later
      }
    }
    await refresh();
  };

  const logout = async () => {
    await api.logout();
    setState({ loading: false, user: null, meData: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

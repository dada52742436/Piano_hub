/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getSessionProfile,
  logout as logoutApi,
  type AuthResponse,
} from '../api/auth';

export interface AuthContextValue {
  user: AuthResponse['user'] | null;
  authReady: boolean;
  isAuthenticated: boolean;
  login: (response: AuthResponse) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    getSessionProfile()
      .then((response) => {
        if (!cancelled) {
          setUser(response.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((response: AuthResponse) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(response.user);
    setAuthReady(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout network failures and still clear local auth state.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setAuthReady(true);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

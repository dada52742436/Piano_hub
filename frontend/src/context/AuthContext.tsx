/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthResponse } from '../api/auth';

// 定义 context 中存放的数据结构
export interface AuthContextValue {
  user: AuthResponse['user'] | null;   // 当前登录用户，null 表示未登录
  token: string | null;
  login: (response: AuthResponse) => void;   // 登录成功后调用
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// useAuth hook：让组件用 useAuth() 代替繁琐的 useContext(AuthContext)
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// AuthProvider 包裹整个应用，让所有子组件都能访问登录状态
export function AuthProvider({ children }: { children: ReactNode }) {
  // 初始化时从 localStorage 恢复状态，这样刷新页面后不会丢失登录状态
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  );
  const [user, setUser] = useState<AuthResponse['user'] | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as AuthResponse['user']) : null;
  });

  // 登录：把 token 和 user 同时存入 state 和 localStorage
  const login = useCallback((response: AuthResponse) => {
    localStorage.setItem('token', response.accessToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.accessToken);
    setUser(response.user);
  }, []);

  // 登出：清除所有状态
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

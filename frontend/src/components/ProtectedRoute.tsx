import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

// 路由守卫：检查是否已登录
// 已登录 → 正常渲染子组件
// 未登录 → 重定向到 /login，并用 replace 避免污染浏览器历史记录
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

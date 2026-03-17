import axios from 'axios';

// 创建 axios 实例，统一配置
// baseURL 用 /api 前缀，Vite dev server 会把它代理到 localhost:3001
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：每次发请求前，自动从 localStorage 读取 token 并加到 header
// 这样所有请求都不需要手动传 Authorization
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 数据类型定义 ──────────────────────────────────────────
export interface AuthResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    username: string;
  };
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ── API 函数 ───────────────────────────────────────────────
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function getProfile(): Promise<{ message: string; user: AuthResponse['user'] & { createdAt: string } }> {
  const { data } = await api.get('/protected/profile');
  return data;
}

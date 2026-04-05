import { api, authApi } from './client';

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

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await authApi.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await authApi.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function logout(): Promise<{ message: string }> {
  const { data } = await authApi.post<{ message: string }>('/auth/logout');
  return data;
}

export async function getProfile(): Promise<{ message: string; user: AuthResponse['user'] & { createdAt: string } }> {
  const { data } = await api.get('/protected/profile');
  return data;
}

export async function getSessionProfile(): Promise<{ message: string; user: AuthResponse['user'] & { createdAt: string } }> {
  const { data } = await authApi.get('/protected/profile');
  return data;
}

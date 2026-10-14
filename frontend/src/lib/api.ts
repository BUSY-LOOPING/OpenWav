import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthPayload, Tokens } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

const ACCESS_KEY = 'ow.accessToken';
const REFRESH_KEY = 'ow.refreshToken';

type Listener = (tokens: Tokens | null) => void;
const listeners = new Set<Listener>();

export function getTokens(): Tokens | null {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function setTokens(tokens: Tokens | null) {
  if (tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } else {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
  listeners.forEach((listener) => listener(tokens));
}

export function onTokensChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens) config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  return config;
});

let refreshing: Promise<Tokens | null> | null = null;

export function refreshTokens(): Promise<Tokens | null> {
  if (refreshing) return refreshing;
  const current = getTokens();
  if (!current) return Promise.resolve(null);
  refreshing = axios
    .post<{ data: AuthPayload }>(`${API_URL}/auth/refresh`, { refreshToken: current.refreshToken })
    .then(({ data }) => {
      setTokens(data.data.tokens);
      return data.data.tokens;
    })
    .catch(() => {
      setTokens(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.error?.code;
    if (error.response?.status === 401 && original && !original._retried && code === 'TOKEN_EXPIRED') {
      original._retried = true;
      const tokens = await refreshTokens();
      if (tokens) {
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      }
    }
    if (error.response?.status === 401 && code !== 'TOKEN_EXPIRED' && getTokens() && !original?.url?.startsWith('/auth/')) setTokens(null);
    return Promise.reject(error);
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await api.get<{ data: T }>(url, { params });
  return data.data;
}

export async function getPage<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await api.get<{ data: T[]; nextCursor: string | null }>(url, { params });
  return data;
}

export async function send<T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown) {
  const { data } = await api.request<{ data: T }>({ method, url, data: body });
  return data?.data;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: { message?: string } })?.error?.message ?? fallback;
  return fallback;
}

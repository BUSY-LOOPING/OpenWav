import api from './api';
import type { LoginRequest, RegisterRequest } from '../types/auth';

export const authAPI = {
  login: (credentials: LoginRequest) =>
    api.post('/auth/login', credentials),

  register: (userData: RegisterRequest) =>
    api.post('/auth/register', userData),

  refreshToken: (token: string) =>
    api.post('/auth/refresh', { refreshToken: token }),

  getCurrentUser: () =>
    api.get('/auth/profile'),

  logout: (token: string) =>
    api.post('/auth/logout', { refreshToken: token }),
};
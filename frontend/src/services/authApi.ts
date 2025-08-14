import axios from 'axios';
import type { LoginRequest, RegisterRequest } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_EXPRESS_BACKEND_URL || "http://localhost:3001/api/v1";

export const authAPI = {
  login: (credentials: LoginRequest) =>
    axios.post(`${API_BASE_URL}/auth/login`, credentials),
    
  register: (userData: RegisterRequest) =>
    axios.post(`${API_BASE_URL}/auth/register`, userData),
    
  refreshToken: (refreshToken: string) =>
    axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }),
    
  getCurrentUser: (accessToken: string) =>
    axios.get(`${API_BASE_URL}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }),
    
  logout: (refreshToken: string) =>
    axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken })
};

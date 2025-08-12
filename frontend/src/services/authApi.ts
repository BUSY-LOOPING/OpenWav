import axios from 'axios';
import type { LoginRequest, RegisterRequest } from '../types/auth';

const API_BASE_URL = 'http://localhost:3001/api/v1/auth';

export const authAPI = {
  login: (credentials: LoginRequest) =>
    axios.post(`${API_BASE_URL}/login`, credentials),
    
  register: (userData: RegisterRequest) =>
    axios.post(`${API_BASE_URL}/register`, userData),
    
  refreshToken: (refreshToken: string) =>
    axios.post(`${API_BASE_URL}/refresh`, { refreshToken }),
    
  getCurrentUser: (accessToken: string) =>
    axios.get(`${API_BASE_URL}/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }),
    
  logout: (refreshToken: string) =>
    axios.post(`${API_BASE_URL}/logout`, { refreshToken })
};

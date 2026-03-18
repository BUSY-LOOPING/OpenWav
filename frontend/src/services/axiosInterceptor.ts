import api from './api';
import { store } from '../store';
import { refreshToken, logout } from '../store/slices/authSlice';

api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  console.log('axiosInterceptor token=', token)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const resToken = await store.dispatch(refreshToken());
      if (refreshToken.fulfilled.match(resToken)) {
        original.headers.Authorization = `Bearer ${resToken.payload}`;
        return api(original);
      } else {
        store.dispatch(logout());
      }
    }
    return Promise.reject(err);
  }
);
import axios from 'axios';
import { store } from '../store';
import { refreshToken, logout } from '../store/slices/authSlice';

axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const resToken = await store.dispatch(refreshToken());
      if (refreshToken.fulfilled.match(resToken)) {
        original.headers.Authorization = `Bearer ${resToken.payload}`;
        return axios(original);
      } else {
        store.dispatch(logout());
      }
    }
    return Promise.reject(err);
  }
);

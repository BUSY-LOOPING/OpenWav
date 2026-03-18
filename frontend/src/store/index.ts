import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import playerReducer from './slices/playerSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    player: playerReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


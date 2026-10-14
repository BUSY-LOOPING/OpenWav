import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import auth from './auth';
import player from './player';

export function makeStore() {
  return configureStore({ reducer: { auth, player } });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export const selectCurrentTrack = (state: RootState) => state.player.queue[state.player.index] ?? null;

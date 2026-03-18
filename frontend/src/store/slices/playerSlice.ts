import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface PlayerTrack {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  duration?: number;
}

interface PlayerState {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  seekTarget: number | null;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'one' | 'all';
}

const initialState: PlayerState = {
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  progress: 0,
  duration: 0,
  seekTarget: null,
  volume: 0.8,
  isMuted: false,
  isShuffled: false,
  repeatMode: 'off',
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    playTrack(state, action: PayloadAction<{ track: PlayerTrack; queue?: PlayerTrack[] }>) {
      const { track, queue } = action.payload;
      state.currentTrack = track;
      state.isPlaying = true;
      state.progress = 0;
      state.seekTarget = null;
      if (queue) {
        state.queue = queue;
        state.queueIndex = queue.findIndex(t => t.id === track.id);
      }
    },
    togglePlay(state) {
      state.isPlaying = !state.isPlaying;
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    setProgress(state, action: PayloadAction<number>) {
      state.progress = action.payload;
    },
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },
    seek(state, action: PayloadAction<number>) {
      state.seekTarget = action.payload;
      state.progress = action.payload;
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = action.payload;
      state.isMuted = false;
    },
    toggleMute(state) {
      state.isMuted = !state.isMuted;
    },
    toggleShuffle(state) {
      state.isShuffled = !state.isShuffled;
    },
    cycleRepeat(state) {
      const modes: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
      const idx = modes.indexOf(state.repeatMode);
      state.repeatMode = modes[(idx + 1) % modes.length];
    },
    playNext(state) {
      if (!state.queue.length) return;
      if (state.repeatMode === 'one') {
        state.seekTarget = 0;
        state.progress = 0;
        state.isPlaying = true;
        return;
      }
      const next = state.queueIndex + 1;
      if (next < state.queue.length) {
        state.queueIndex = next;
        state.currentTrack = state.queue[next];
        state.progress = 0;
        state.seekTarget = null;
        state.isPlaying = true;
      } else if (state.repeatMode === 'all') {
        state.queueIndex = 0;
        state.currentTrack = state.queue[0];
        state.progress = 0;
        state.seekTarget = null;
        state.isPlaying = true;
      } else {
        state.isPlaying = false;
      }
    },
    playPrev(state) {
      if (!state.queue.length) return;
      if (state.progress > 3) {
        state.seekTarget = 0;
        state.progress = 0;
        return;
      }
      const prev = state.queueIndex - 1;
      if (prev >= 0) {
        state.queueIndex = prev;
        state.currentTrack = state.queue[prev];
        state.progress = 0;
        state.seekTarget = null;
        state.isPlaying = true;
      }
    },
  },
});

export const {
  playTrack,
  togglePlay,
  setPlaying,
  setProgress,
  setDuration,
  seek,
  setVolume,
  toggleMute,
  toggleShuffle,
  cycleRepeat,
  playNext,
  playPrev,
} = playerSlice.actions;

export default playerSlice.reducer;
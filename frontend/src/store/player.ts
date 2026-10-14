import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Track } from '../lib/types';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  queue: Track[];
  original: Track[] | null;
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  seekRequest: { time: number; id: number } | null;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  nowPlayingOpen: boolean;
}

export const initialPlayerState: PlayerState = {
  queue: [],
  original: null,
  index: -1,
  isPlaying: false,
  position: 0,
  duration: 0,
  seekRequest: null,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'off',
  nowPlayingOpen: false,
};

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startAt(state: PlayerState, index: number) {
  state.index = index;
  state.position = 0;
  state.duration = state.queue[index]?.durationSec ?? 0;
  state.seekRequest = null;
  state.isPlaying = true;
}

function requestSeek(state: PlayerState, time: number) {
  state.seekRequest = { time, id: (state.seekRequest?.id ?? 0) + 1 };
  state.position = time;
}

const playerSlice = createSlice({
  name: 'player',
  initialState: initialPlayerState,
  reducers: {
    playTracks(state, action: PayloadAction<{ tracks: Track[]; startIndex?: number; shuffle?: boolean }>) {
      const { tracks, startIndex = 0 } = action.payload;
      if (!tracks.length) return;
      const shuffle = action.payload.shuffle ?? state.shuffle;
      state.shuffle = shuffle;
      if (shuffle) {
        const first = tracks[startIndex];
        state.original = tracks;
        state.queue = [first, ...shuffled(tracks.filter((_, i) => i !== startIndex))];
        startAt(state, 0);
      } else {
        state.original = null;
        state.queue = tracks;
        startAt(state, startIndex);
      }
    },
    playNext(state, action: PayloadAction<Track>) {
      if (state.index < 0) {
        state.queue = [action.payload];
        startAt(state, 0);
        return;
      }
      state.queue.splice(state.index + 1, 0, action.payload);
      state.original?.push(action.payload);
    },
    addToQueue(state, action: PayloadAction<Track>) {
      state.queue.push(action.payload);
      state.original?.push(action.payload);
      if (state.index < 0) startAt(state, 0);
    },
    removeFromQueue(state, action: PayloadAction<number>) {
      const removeAt = action.payload;
      if (removeAt === state.index) return;
      const [removed] = state.queue.splice(removeAt, 1);
      if (state.original && removed) state.original = state.original.filter((t) => t.id !== removed.id);
      if (removeAt < state.index) state.index -= 1;
    },
    moveInQueue(state, action: PayloadAction<{ from: number; to: number }>) {
      const { from, to } = action.payload;
      if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return;
      const current = state.queue[state.index];
      const [moved] = state.queue.splice(from, 1);
      state.queue.splice(to, 0, moved);
      state.index = state.queue.findIndex((t) => t === current || t.id === current?.id);
    },
    jumpTo(state, action: PayloadAction<number>) {
      if (action.payload >= 0 && action.payload < state.queue.length) startAt(state, action.payload);
    },
    next(state) {
      if (state.index < state.queue.length - 1) startAt(state, state.index + 1);
      else if (state.repeat === 'all' && state.queue.length) startAt(state, 0);
      else state.isPlaying = false;
    },
    prev(state) {
      if (state.position > 3 || state.index <= 0) requestSeek(state, 0);
      else startAt(state, state.index - 1);
    },
    ended(state) {
      if (state.repeat === 'one') {
        requestSeek(state, 0);
        state.isPlaying = true;
      } else if (state.index < state.queue.length - 1) startAt(state, state.index + 1);
      else if (state.repeat === 'all') startAt(state, 0);
      else {
        state.isPlaying = false;
        requestSeek(state, 0);
      }
    },
    togglePlay(state) {
      if (state.index >= 0) state.isPlaying = !state.isPlaying;
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    setPosition(state, action: PayloadAction<number>) {
      state.position = action.payload;
    },
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },
    seek(state, action: PayloadAction<number>) {
      requestSeek(state, Math.max(0, Math.min(action.payload, state.duration || action.payload)));
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = Math.max(0, Math.min(1, action.payload));
      state.muted = state.volume === 0;
    },
    toggleMute(state) {
      state.muted = !state.muted;
    },
    toggleShuffle(state) {
      const current = state.queue[state.index];
      if (!current) {
        state.shuffle = !state.shuffle;
        return;
      }
      if (state.shuffle && state.original) {
        state.queue = state.original;
        state.index = Math.max(0, state.original.findIndex((t) => t.id === current.id));
        state.original = null;
        state.shuffle = false;
      } else {
        state.original = [...state.queue];
        state.queue = [current, ...shuffled(state.queue.filter((_, i) => i !== state.index))];
        state.index = 0;
        state.shuffle = true;
      }
    },
    cycleRepeat(state) {
      state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    },
    setLiked(state, action: PayloadAction<{ id: string; liked: boolean }>) {
      for (const list of [state.queue, state.original ?? []]) {
        for (const track of list) if (track.id === action.payload.id) track.liked = action.payload.liked;
      }
    },
    setNowPlayingOpen(state, action: PayloadAction<boolean>) {
      state.nowPlayingOpen = action.payload;
    },
  },
});

export const {
  playTracks,
  playNext,
  addToQueue,
  removeFromQueue,
  moveInQueue,
  jumpTo,
  next,
  prev,
  ended,
  togglePlay,
  setPlaying,
  setPosition,
  setDuration,
  seek,
  setVolume,
  toggleMute,
  toggleShuffle,
  cycleRepeat,
  setLiked,
  setNowPlayingOpen,
} = playerSlice.actions;

export default playerSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ProgressEvent, Task, TaskStatus } from '../lib/types';

export interface DownloadEntry {
  taskId: string;
  status: TaskStatus;
  progress: number;
  mediaId: string | null;
  error: string | null;
}

export const ACTIVE_STATUSES: TaskStatus[] = ['queued', 'downloading', 'uploading'];

export function videoIdOf(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.hostname === 'youtu.be' ? url.pathname.slice(1) || null : url.searchParams.get('v');
  } catch {
    return null;
  }
}

const slice = createSlice({
  name: 'downloads',
  initialState: { byVideo: {} as Record<string, DownloadEntry> },
  reducers: {
    hydrated(state, { payload }: PayloadAction<Task[]>) {
      for (const t of payload) {
        const key = videoIdOf(t.url);
        if (key && !state.byVideo[key]) state.byVideo[key] = { taskId: t.id, status: t.status, progress: t.progress, mediaId: t.mediaId, error: t.errorMessage };
      }
    },
    started(state, { payload }: PayloadAction<{ videoId: string; taskId: string }>) {
      state.byVideo[payload.videoId] = { taskId: payload.taskId, status: 'queued', progress: 0, mediaId: null, error: null };
    },
    progressed(state, { payload: e }: PayloadAction<ProgressEvent>) {
      const key = videoIdOf(e.url) ?? Object.keys(state.byVideo).find((k) => state.byVideo[k].taskId === e.taskId);
      if (!key) return;
      const prev = state.byVideo[key];
      // A deferred duplicate reports queued while the real download is still running
      if (prev && prev.taskId !== e.taskId && ACTIVE_STATUSES.includes(prev.status) && e.status === 'queued') return;
      state.byVideo[key] = {
        taskId: e.taskId,
        status: e.status,
        progress: e.progress ?? (prev?.taskId === e.taskId ? prev.progress : 0),
        mediaId: e.mediaId ?? prev?.mediaId ?? null,
        error: e.error,
      };
    },
  },
});

export const { hydrated, started, progressed } = slice.actions;
export default slice.reducer;

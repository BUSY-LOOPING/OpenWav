import { API_URL, api, getTokens } from './api';

export type EventType =
  | 'play_start'
  | 'play_progress'
  | 'play_complete'
  | 'skip'
  | 'like'
  | 'unlike'
  | 'search'
  | 'add_to_playlist'
  | 'remove_from_playlist'
  | 'download_request'
  | 'page_view';

export interface TrackingEvent {
  type: EventType;
  mediaId?: string;
  playlistId?: string;
  query?: string;
  positionSec?: number;
  durationSec?: number;
  path?: string;
  occurredAt?: string;
}

interface TrackerOptions {
  send: (events: TrackingEvent[], keepalive: boolean) => Promise<unknown>;
  flushIntervalMs?: number;
  maxBatch?: number;
}

export function createEventTracker({ send, flushIntervalMs = 10_000, maxBatch = 20 }: TrackerOptions) {
  let buffer: TrackingEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(keepalive = false) {
    if (timer) clearTimeout(timer);
    timer = null;
    while (buffer.length) {
      const batch = buffer.splice(0, 50);
      send(batch, keepalive).catch(() => undefined);
    }
  }

  function track(event: TrackingEvent) {
    if (!getTokens()) return;
    buffer.push({ ...event, occurredAt: event.occurredAt ?? new Date().toISOString() });
    if (buffer.length >= maxBatch) flush();
    else if (!timer) timer = setTimeout(() => flush(), flushIntervalMs);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flush(true);
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', () => flush(true));

  return {
    track,
    flush,
    pending: () => buffer.length,
    dispose() {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timer) clearTimeout(timer);
      buffer = [];
    },
  };
}

export const tracker = createEventTracker({
  send(events, keepalive) {
    if (keepalive) {
      const tokens = getTokens();
      return fetch(`${API_URL}/events`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
        body: JSON.stringify({ events }),
      });
    }
    return api.post('/events', { events });
  },
});

export const track = (event: TrackingEvent) => tracker.track(event);

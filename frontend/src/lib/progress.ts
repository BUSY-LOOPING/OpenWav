import { useEffect, useRef } from 'react';
import { API_URL, send } from './api';
import { loadAll } from './queries';
import type { ProgressEvent, Task } from './types';
import { hydrated, progressed } from '../store/downloads';
import { useAppDispatch } from '../store';

type Listener = (event: ProgressEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let reconnect: ReturnType<typeof setTimeout> | null = null;

async function open() {
  if (source || !listeners.size) return;
  try {
    const { ticket } = await send<{ ticket: string; expiresAt: string }>('post', '/tickets', { purpose: 'progress' });
    if (!listeners.size) return;
    source = new EventSource(`${API_URL}/progress?ticket=${encodeURIComponent(ticket)}`);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ProgressEvent;
      listeners.forEach((listener) => listener(event));
    };
    source.onerror = () => {
      source?.close();
      source = null;
      if (listeners.size && !reconnect) reconnect = setTimeout(() => ((reconnect = null), open()), 3000);
    };
  } catch {
    if (!reconnect) reconnect = setTimeout(() => ((reconnect = null), open()), 5000);
  }
}

export function subscribeProgress(listener: Listener) {
  listeners.add(listener);
  open();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      source?.close();
      source = null;
    }
  };
}

export function useProgress(onEvent: Listener, enabled = true) {
  const ref = useRef(onEvent);
  ref.current = onEvent;
  useEffect(() => {
    if (!enabled) return;
    return subscribeProgress((event) => ref.current(event));
  }, [enabled]);
}

export function useDownloadSync(enabled: boolean) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!enabled) return;
    loadAll<Task>('/downloads', { active: true }).then((tasks) => dispatch(hydrated(tasks)), () => undefined);
  }, [enabled, dispatch]);
  useProgress((event) => dispatch(progressed(event)), enabled);
}

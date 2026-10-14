import { send } from './api';

interface Signed {
  url: string;
  expiresAt: string;
}

const cache = new Map<string, Promise<Signed>>();
const MARGIN_MS = 60_000;

export async function getStreamUrl(mediaId: string): Promise<Signed> {
  const cached = cache.get(mediaId);
  if (cached) {
    const value = await cached.catch(() => null);
    if (value && new Date(value.expiresAt).getTime() - Date.now() > MARGIN_MS) return value;
  }
  const request = send<Signed>('post', `/media/${mediaId}/stream`);
  cache.set(mediaId, request);
  request.catch(() => cache.delete(mediaId));
  return request;
}

export function msUntilRefresh(expiresAt: string) {
  return Math.max(5_000, new Date(expiresAt).getTime() - Date.now() - MARGIN_MS);
}

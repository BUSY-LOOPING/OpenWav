import { describe, expect, it } from 'vitest';
import {
  assertTopology,
  buildProgressEvent,
  retryDelayMs,
  downloadJobSchema,
  isAllowedDomain,
  isPlaylistUrl,
  trackingEventSchema,
} from '../src/contracts.js';

const uuid = '0b6f1c4e-5a7f-4d2b-9a3e-1f2d3c4b5a69';

describe('downloadJobSchema', () => {
  it('fills optional playlist fields with null', () => {
    const job = downloadJobSchema.parse({ taskId: uuid, url: 'https://youtu.be/x', format: 'mp3', quality: '192k', userId: uuid });
    expect(job).toMatchObject({ playlistTaskId: null, playlistId: null, position: null });
  });

  it('rejects unknown formats', () => {
    expect(downloadJobSchema.safeParse({ taskId: uuid, url: 'https://youtu.be/x', format: 'exe', quality: '192k', userId: null }).success).toBe(false);
  });
});

describe('isAllowedDomain', () => {
  it('accepts exact and sub domains', () => {
    expect(isAllowedDomain('https://www.youtube.com/watch?v=1', ['youtube.com'])).toBe(true);
    expect(isAllowedDomain('https://youtube.com/watch?v=1', ['youtube.com'])).toBe(true);
  });

  it('rejects look-alike domains', () => {
    expect(isAllowedDomain('https://evilyoutube.com/watch?v=1', ['youtube.com'])).toBe(false);
  });
});

describe('isPlaylistUrl', () => {
  it.each([
    ['https://www.youtube.com/playlist?list=PL1', true],
    ['https://music.youtube.com/playlist?list=PL1', true],
    ['https://www.youtube.com/watch?v=abc&list=PL1', false],
    ['https://soundcloud.com/artist/sets/album', true],
    ['https://soundcloud.com/artist/track', false],
  ])('%s -> %s', (url, expected) => {
    expect(isPlaylistUrl(url)).toBe(expected);
  });
});

describe('buildProgressEvent', () => {
  it('produces a valid event with a timestamp', () => {
    const event = buildProgressEvent({ taskId: uuid, status: 'downloading', progress: 42 });
    expect(event.timestamp).toMatch(/T/);
    expect(event.error).toBeNull();
  });
});

describe('trackingEventSchema', () => {
  it('rejects unknown event types', () => {
    expect(trackingEventSchema.safeParse({ type: 'hack' }).success).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially and caps at 15 minutes', () => {
    expect(retryDelayMs(0)).toBe(30_000);
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(10)).toBe(900_000);
  });
});

describe('assertTopology', () => {
  it('declares every queue with dead lettering and binds the retry loop', async () => {
    const calls = [];
    const channel = new Proxy({}, { get: (_, name) => async (...args) => calls.push([name, ...args]) });
    await assertTopology(channel);
    const queues = calls.filter(([n]) => n === 'assertQueue').map(([, q]) => q);
    expect(queues).toEqual(['downloads.dead', 'downloads', 'playlists', 'downloads.retry']);
    expect(calls).toContainEqual(['bindQueue', 'downloads.retry', 'downloads.retry', 'downloads']);
  });
});

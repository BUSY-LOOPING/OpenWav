import { describe, expect, it } from 'vitest';
import reducer, { hydrated, progressed, started, videoIdOf } from './downloads';
import type { ProgressEvent, Task } from '../lib/types';

const event = (e: Partial<ProgressEvent>): ProgressEvent => ({ taskId: 't1', status: 'downloading', progress: null, title: null, error: null, url: null, mediaId: null, ...e });

describe('downloads store', () => {
  it('reads video ids from watch and short links', () => {
    expect(videoIdOf('https://www.youtube.com/watch?v=abc')).toBe('abc');
    expect(videoIdOf('https://youtu.be/xyz')).toBe('xyz');
    expect(videoIdOf('not a url')).toBeNull();
  });

  it('keys every task by video so search and playlist rows share one progress', () => {
    let state = reducer(undefined, hydrated([{ id: 't1', url: 'https://www.youtube.com/watch?v=abc', status: 'queued', progress: 0, mediaId: null, errorMessage: null } as Task]));
    state = reducer(state, progressed(event({ url: 'https://www.youtube.com/watch?v=abc', progress: 40 })));
    expect(state.byVideo.abc).toMatchObject({ taskId: 't1', status: 'downloading', progress: 40 });
    state = reducer(state, progressed(event({ taskId: 'dupe', url: 'https://youtu.be/abc', status: 'queued', progress: 0 })));
    expect(state.byVideo.abc).toMatchObject({ taskId: 't1', progress: 40 });
    state = reducer(state, progressed(event({ status: 'uploading' })));
    expect(state.byVideo.abc).toMatchObject({ status: 'uploading', progress: 40 });
    state = reducer(state, progressed(event({ url: 'https://youtu.be/abc', status: 'completed', progress: 100, mediaId: 'm1' })));
    expect(state.byVideo.abc).toMatchObject({ status: 'completed', mediaId: 'm1' });
    state = reducer(state, hydrated([{ id: 'old', url: 'https://youtu.be/abc', status: 'queued', progress: 0, mediaId: null, errorMessage: null } as Task]));
    expect(state.byVideo.abc.taskId).toBe('t1');
    state = reducer(state, started({ videoId: 'abc', taskId: 't2' }));
    expect(state.byVideo.abc).toMatchObject({ taskId: 't2', status: 'queued', progress: 0, mediaId: null });
  });

  it('ignores events for tasks it cannot place', () => {
    expect(reducer(undefined, progressed(event({ taskId: 'nope' }))).byVideo).toEqual({});
  });
});

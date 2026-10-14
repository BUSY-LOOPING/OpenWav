import { useEffect, useRef } from 'react';
import { useStore } from 'react-redux';
import { track as trackEvent } from '../lib/events';
import { getStreamUrl, msUntilRefresh } from '../lib/stream';
import { cycleRepeat, ended, next, prev, seek, setDuration, setPlaying, setPosition, toggleMute, togglePlay } from '../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector, type AppStore } from '../store';

const PROGRESS_EVERY_SEC = 30;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function AudioEngine({ onHelp }: { onHelp: () => void }) {
  const dispatch = useAppDispatch();
  const store = useStore() as AppStore;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentId = useAppSelector((s) => selectCurrentTrack(s)?.id ?? null);
  const upcomingId = useAppSelector((s) => s.player.queue[s.player.index + 1]?.id ?? null);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const volume = useAppSelector((s) => s.player.volume);
  const muted = useAppSelector((s) => s.player.muted);
  const seekRequest = useAppSelector((s) => s.player.seekRequest);
  const listened = useRef({ id: '', lastReported: 0, completed: false });

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    let lastTick = 0;
    const onTime = () => {
      const now = performance.now();
      if (now - lastTick < 250) return;
      lastTick = now;
      dispatch(setPosition(audio.currentTime));
      const state = listened.current;
      if (state.id && audio.currentTime - state.lastReported >= PROGRESS_EVERY_SEC) {
        state.lastReported = audio.currentTime;
        trackEvent({ type: 'play_progress', mediaId: state.id, positionSec: Math.round(audio.currentTime), durationSec: Math.round(audio.duration || 0) });
      }
      if ('mediaSession' in navigator && Number.isFinite(audio.duration)) {
        navigator.mediaSession.setPositionState?.({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate });
      }
    };
    const onMeta = () => Number.isFinite(audio.duration) && dispatch(setDuration(audio.duration));
    const onEnded = () => {
      const state = listened.current;
      if (state.id) {
        state.completed = true;
        trackEvent({ type: 'play_complete', mediaId: state.id, durationSec: Math.round(audio.duration || 0) });
      }
      dispatch(ended());
    };
    const onPlay = () => dispatch(setPlaying(true));
    const onPause = () => !audio.ended && dispatch(setPlaying(false));
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [dispatch]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = selectCurrentTrack(store.getState());
    const previous = listened.current;
    if (previous.id && previous.id !== current?.id && !previous.completed && audio.duration && audio.currentTime < audio.duration * 0.9) {
      trackEvent({ type: 'skip', mediaId: previous.id, positionSec: Math.round(audio.currentTime), durationSec: Math.round(audio.duration) });
    }
    if (!current) {
      audio.pause();
      audio.removeAttribute('src');
      listened.current = { id: '', lastReported: 0, completed: false };
      return;
    }
    listened.current = { id: current.id, lastReported: 0, completed: false };
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retried = false;

    const load = async (resumeAt = 0) => {
      const signed = await getStreamUrl(current.id);
      if (cancelled) return;
      audio.src = signed.url;
      if (resumeAt) audio.currentTime = resumeAt;
      if (store.getState().player.isPlaying) audio.play().catch(() => dispatch(setPlaying(false)));
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        const fresh = await getStreamUrl(current.id).catch(() => null);
        if (!fresh || cancelled) return;
        const at = audio.currentTime;
        const wasPlaying = !audio.paused;
        audio.src = fresh.url;
        audio.currentTime = at;
        if (wasPlaying) audio.play().catch(() => undefined);
      }, msUntilRefresh(signed.expiresAt));
    };

    const onError = () => {
      if (retried || cancelled) return dispatch(setPlaying(false));
      retried = true;
      load(audio.currentTime).catch(() => dispatch(setPlaying(false)));
    };
    audio.addEventListener('error', onError);
    load().catch(() => dispatch(setPlaying(false)));
    trackEvent({ type: 'play_start', mediaId: current.id, durationSec: current.durationSec ?? undefined });

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artists.map((a) => a.name).join(', '),
        album: current.album?.name ?? '',
        artwork: current.thumbnailUrl ? [{ src: current.thumbnailUrl, sizes: '512x512' }] : [],
      });
    }
    return () => {
      cancelled = true;
      clearTimeout(refreshTimer);
      audio.removeEventListener('error', onError);
    };
  }, [currentId, dispatch, store]);

  useEffect(() => {
    if (upcomingId) getStreamUrl(upcomingId).catch(() => undefined);
  }, [upcomingId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying && audio.paused) audio.play().catch(() => dispatch(setPlaying(false)));
    if (!isPlaying && !audio.paused) audio.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, dispatch]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (audioRef.current && seekRequest) audioRef.current.currentTime = seekRequest.time;
  }, [seekRequest]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => dispatch(setPlaying(true))],
      ['pause', () => dispatch(setPlaying(false))],
      ['nexttrack', () => dispatch(next())],
      ['previoustrack', () => dispatch(prev())],
      ['seekto', (d) => d.seekTime !== undefined && dispatch(seek(d.seekTime))],
      ['seekbackward', (d) => dispatch(seek(store.getState().player.position - (d.seekOffset ?? 10)))],
      ['seekforward', (d) => dispatch(seek(store.getState().player.position + (d.seekOffset ?? 10)))],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        continue;
      }
    }
  }, [dispatch, store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const position = store.getState().player.position;
      const key = e.key;
      const actions: Record<string, () => void> = {
        ' ': () => dispatch(togglePlay()),
        k: () => dispatch(togglePlay()),
        j: () => dispatch(seek(position - 10)),
        l: () => dispatch(seek(position + 10)),
        N: () => dispatch(next()),
        P: () => dispatch(prev()),
        m: () => dispatch(toggleMute()),
        r: () => dispatch(cycleRepeat()),
        '/': () => document.getElementById('global-search')?.focus(),
        '?': onHelp,
      };
      const action = e.shiftKey && (key === 'N' || key === 'P' || key === '?') ? actions[key] : !e.shiftKey ? actions[key] : undefined;
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, store, onHelp]);

  return null;
}

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  setProgress,
  setDuration,
  setPlaying,
  playNext,
} from '../store/slices/playerSlice';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export function useAudioPlayer() {
  const dispatch   = useDispatch<AppDispatch>();
  const audioRef   = useRef<HTMLAudioElement | null>(null);

  const currentTrack = useSelector((s: RootState) => s.player.currentTrack);
  const isPlaying    = useSelector((s: RootState) => s.player.isPlaying);
  const volume       = useSelector((s: RootState) => s.player.volume);
  const isMuted      = useSelector((s: RootState) => s.player.isMuted);
  const seekTarget   = useSelector((s: RootState) => s.player.seekTarget);

  // Create audio element once
  useEffect(() => {
    console.log('current track src', audioRef.current)
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      dispatch(setProgress(audio.currentTime));
    });

    audio.addEventListener('loadedmetadata', () => {
      dispatch(setDuration(audio.duration));
    });

    audio.addEventListener('ended', () => {
      dispatch(playNext());
    });

    audio.addEventListener('pause', () => {
      dispatch(setPlaying(false));
    });

    audio.addEventListener('play', () => {
      dispatch(setPlaying(true));
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      dispatch(setPlaying(false));
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [dispatch]);

  // Load new track when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const token = localStorage.getItem('accessToken');
    audio.src = `${BASE_URL}/media/${currentTrack.id}/stream?token=${token}`;
    audio.load();
    audio.play().catch(console.error);
  }, [currentTrack?.id]);

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync seek
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTarget === undefined || seekTarget === null) return;
    audio.currentTime = seekTarget;
  }, [seekTarget]);
}
export interface PlayerTrack {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  duration?: number;
}

export interface PlayerState {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'one' | 'all';
}

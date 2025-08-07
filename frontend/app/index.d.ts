export interface Track {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  views?: string;
  tracks?: string;
  type?: 'song' | 'playlist' | 'album';
}

export interface Playlist {
  id: string;
  name: string;
  creator: string;
  tracks?: string;
  type: 'auto' | 'user';
}

export interface User {
  name: string;
  avatar: string;
}

export interface CurrentTrack {
  title: string;
  artist: string;
  albumArt: string;
  currentTime: string;
  totalTime: string;
  progress: number;
}

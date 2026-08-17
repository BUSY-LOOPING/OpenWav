export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: [] | null;
  isPublic: boolean;
  createdBy: string;
  ownerUsername: string;
  totalTracks: number;
  totalDuration: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isAuto?: boolean;
  isPinned?: boolean;
}

export interface PlaylistTrackMetadata {
  uploader?: string;
  uploaderUrl?: string;
  uploadDate?: string;
  tags?: string[];
  categories?: string[];
  language?: string | null;
  ageLimit?: number;
  viewCount?: number;
  likeCount?: number;
  webpage_url?: string;
  extractor?: string;
  album?: string;
  artist?: string;
  raw?: Record<string, unknown>;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  thumbnailPath: string | null;
  duration: number | null;
  platform: string | null;
  format: string | null;
  position: number;
  addedAt: string;
  addedBy: string;
  metadata: PlaylistTrackMetadata;
}

export interface PlaylistDetail extends Playlist {
  tracks: PlaylistTrack[];
}
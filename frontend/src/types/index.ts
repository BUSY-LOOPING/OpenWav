export type Platform = "youtube" | "soundcloud" | "vimeo" | "unknown";

export type AudioFormat = "mp3" | "m4a" | "opus" | "flac" | "wav";

export type TaskStatus = "queued" | "downloading" | "completed" | "failed";

export type MediaStatus = "completed" | "processing" | "failed";

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnailUrl?: string;
  platform: Platform;
  format: AudioFormat;
  fileSize?: number;
  uploadedBy?: string;
  createdAt: string;
}

export interface DownloadTask {
  id: string;
  url: string;
  format: AudioFormat;
  quality: string;
  status: TaskStatus;
  progress: number;
  retryCount: number;
  mediaId?: string;
  errorMessage?: string;
  requestedBy?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadProgress {
  taskId: string;
  status: TaskStatus | "started";
  progress: number | null;
  title: string | null;
  error: string | null;
  timestamp: string;
}

export interface NavItem {
  end?: boolean;
  label: string;
  icon: string;
  href: string;
}

export interface QueueItem {
  track: Track;
  queueId: string;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

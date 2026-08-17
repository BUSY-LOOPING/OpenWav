import type { MediaItem } from "../types/api";
import type { Track } from "../index";

export const convertMediaToTrack = (media: MediaItem): Track => {
  const API_BACKEND_URL = import.meta.env.VITE_EXPRESS_BACKEND_URL || "http://localhost:3001/";
  // Format duration from seconds to mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes);
    const mb = (size / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  // Format views/likes count
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return {
    id: media.id,
    title: media.title,
    artist: media.uploaderUsername,
    albumArt: `${API_BACKEND_URL}/${media.thumbnailPath}`,
    views: media.likesCount > 0 ? `${formatCount(media.likesCount)} likes` : undefined,
    tracks: `${formatDuration(media.duration)} • ${formatFileSize(media.fileSize)}`,
    type: 'song'
  };
};

export const convertMediaArrayToTracks = (mediaArray: MediaItem[]): Track[] => {
  return mediaArray.map(convertMediaToTrack);
};

export function buildThumbnailUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${import.meta.env.VITE_MINIO_PUBLIC_URL}/${path}`;
}

export function formatTime(seconds: number, expanded = false): string {
  if (!seconds || isNaN(seconds)) return expanded ? '0 minutes' : '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (expanded) {
    if (h > 0) return `${h} hours ${m} minutes`;
    if (m > 0) return `${m} minutes ${s} seconds`;
    if (s > 0) return `${s} seconds`
    return `${s} second`;
  }

  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
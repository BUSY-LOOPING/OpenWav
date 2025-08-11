import type { MediaItem } from "../types/api";
import type { Track } from "../index";

export const convertMediaToTrack = (media: MediaItem): Track => {
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
    albumArt: `http://localhost:3001/${media.thumbnailPath}`,
    views: media.likesCount > 0 ? `${formatCount(media.likesCount)} likes` : undefined,
    tracks: `${formatDuration(media.duration)} • ${formatFileSize(media.fileSize)}`,
    type: 'song'
  };
};

export const convertMediaArrayToTracks = (mediaArray: MediaItem[]): Track[] => {
  return mediaArray.map(convertMediaToTrack);
};

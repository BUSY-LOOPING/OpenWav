import { useState } from "react";
import type { PlaylistDetails } from "../index";
import PlaylistControls from "./PlaylistControls";

interface PlaylistHeaderProps {
  playlist: PlaylistDetails;
}

export default function PlaylistHeader({ playlist }: PlaylistHeaderProps) {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const API_BASE_URL = import.meta.env.VITE_EXPRESS_BACKEND_URL || "http://localhost:3001/api/v1";
  const BACKEND_URL = import.meta.env.VITE_EXPRESS_BACKEND_URL || "http://localhost:3001";


  const handleImageError = (index: number) => {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  const getThumbnailUrl = (thumbnailPath: string) => {
    if (thumbnailPath.startsWith("http")) {
      return thumbnailPath;
    }
    return `${BACKEND_URL}/${thumbnailPath}`;
  };

  const tracksWithThumbnails =
    playlist.tracks?.filter((track) => track.thumbnailPath).slice(0, 4) || [];

  const renderPlaylistCover = () => {
    if (tracksWithThumbnails.length === 0) {
      return (
        <div className="w-60 h-60 bg-gray-700 rounded-lg shadow-2xl flex items-center justify-center">
          <span className="material-icons text-gray-500 text-6xl">
            queue_music
          </span>
        </div>
      );
    }

    if (tracksWithThumbnails.length < 4) {
      return (
        <div className="w-60 h-60 mb-8">
          {imageErrors[0] ? (
            <div className="w-full h-full bg-gray-700 rounded-lg shadow-2xl flex items-center justify-center">
              <span className="material-icons text-gray-500 text-6xl">
                queue_music
              </span>
            </div>
          ) : (
            <img
              src={getThumbnailUrl(tracksWithThumbnails[0].thumbnailPath!)}
              alt={playlist.name}
              className="w-full h-full object-cover rounded-lg shadow-2xl"
              onError={() => handleImageError(0)}
            />
          )}
        </div>
      );
    }

    return (
      <div className="w-60 h-60 grid grid-cols-2 gap-1 rounded-lg overflow-hidden shadow-2xl">
        {Array.from({ length: 4 }).map((_, index) => {
          const track = tracksWithThumbnails[index];

          if (!track) {
            return (
              <div
                key={index}
                className="bg-gray-700 flex items-center justify-center"
              >
                <span className="material-icons text-gray-500 text-3xl">
                  music_note
                </span>
              </div>
            );
          }

          return (
            <div key={track.id} className="relative">
              {imageErrors[index] ? (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <span className="material-icons text-gray-500 text-3xl">
                    music_note
                  </span>
                </div>
              ) : (
                <img
                  src={getThumbnailUrl(track.thumbnailPath!)}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(index)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative p-[2rem]">
      <div className="flex flex-col items-center mb-4">
        <div className="flex-shrink-0 mb-8">{renderPlaylistCover()}</div>
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <h1 className="text-[2rem] font-semibold text-white mb-6 leading-tight">
            {playlist.name}
          </h1>

          {playlist.description && (
            <p className="text-white/70 text-base mb-4 max-w-2xl text=[1.5rem]">
              {playlist.description}
            </p>
          )}

          <div className="flex items-center gap-[0.3rem] text-sm text-white/70">  
            {playlist.creatorAvatar && playlist.creatorAvatar.trim() !== '' && (
              <img
              src={playlist.creatorAvatar}
              alt={playlist.creator}
              className="w-6 h-6 rounded-full"
            />
            )}
            {playlist.followers && playlist.followers.trim() !== '' && (
              <>
                <span>•</span>
                <span>{playlist.followers}followers</span>
                <span>•</span>
              </>
            )}

            <span>{playlist.trackCount || playlist.total_tracks} songs</span>
            <span className="text-white/50">{playlist.totalDuration}</span>
          </div>
        </div>
      </div>
      <PlaylistControls />
    </div>
  );
}

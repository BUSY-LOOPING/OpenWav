import { useEffect, useState } from "react";

interface Playlist {
  id: string;
  name: string;
  description?: string;
  total_tracks: number;
  total_duration: number;
  tracks?: Array<{
    id: string;
    title: string;
    thumbnailPath?: string;
  }>;
  created_by?: string;
  updated_at?: string;
}

interface PlaylistCardProps {
  playlist: Playlist;
  onPlay?: (playlist: Playlist) => void;
  onLike?: (playlist: Playlist) => void;
  onAddToPlaylist?: (playlist: Playlist) => void;
  onClick?: (playlist: Playlist) => void;
}

export default function PlaylistCard({
  playlist,
  onPlay,
  onLike,
  onAddToPlaylist,
  onClick,
}: PlaylistCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const API_BASE_URL = import.meta.env.VITE_EXPRESS_BACKEND_URL || "http://localhost:3001/";

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) onPlay(playlist);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    if (onLike) onLike(playlist);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToPlaylist) onAddToPlaylist(playlist);
    setShowMenu(false);
  };

  const handleCardClick = () => {
    if (onClick) onClick(playlist);
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getThumbnailUrl = (thumbnailPath: string) => {
    if (thumbnailPath.startsWith('http')) {
      return thumbnailPath;
    }
    return `${API_BASE_URL}/${thumbnailPath}`;
  };

  const tracksWithThumbnails = playlist.tracks?.filter(track => track.thumbnailPath).slice(0, 4) || [];
  
  const renderPlaylistCover = () => {
    if (tracksWithThumbnails.length === 0) {
      return (
        <div className="w-full h-48 bg-gray-700 rounded-md mb-4 flex items-center justify-center">
          <span className="material-icons text-gray-500 text-4xl">
            queue_music
          </span>
        </div>
      );
    }

    if (tracksWithThumbnails.length === 1) {
      return (
        <div className="w-full h-48 mb-4">
          {imageErrors[0] ? (
            <div className="w-full h-full bg-gray-700 rounded-md flex items-center justify-center">
              <span className="material-icons text-gray-500 text-4xl">
                queue_music
              </span>
            </div>
          ) : (
            <img
              src={getThumbnailUrl(tracksWithThumbnails[0].thumbnailPath!)}
              alt={playlist.name}
              className="w-full h-full object-cover rounded-md"
              onError={() => handleImageError(0)}
            />
          )}
        </div>
      );
    }

    return (
      <div className="w-full h-48 mb-4 grid grid-cols-2 gap-1 rounded-md overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => {
          const track = tracksWithThumbnails[index];
          
          if (!track) {
            return (
              <div 
                key={index}
                className="bg-gray-700 flex items-center justify-center"
              >
                <span className="material-icons text-gray-500 text-2xl">
                  music_note
                </span>
              </div>
            );
          }

          return (
            <div key={track.id} className="relative">
              {imageErrors[index] ? (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <span className="material-icons text-gray-500 text-2xl">
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
    <div
      className="card p-4 relative group cursor-pointer"
      style={{ backgroundColor: "#181818" }}
      onClick={handleCardClick}
    >
      <div className="relative">
        {renderPlaylistCover()}

        <div className="absolute bottom-6 right-4">
          <button
            onClick={handlePlay}
            className="play-button bg-white text-black rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 w-12 h-12 flex items-center justify-center hover:bg-amber-50 hover:scale-105"
          >
            <span className="material-icons text-2xl">play_arrow</span>
          </button>
        </div>

        <div className="absolute top-4 right-4">
          <button
            onClick={handleLike}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white hover:text-white"
          >
            <span className="material-icons text-xl">
              {isLiked ? "favorite" : "favorite_border"}
            </span>
          </button>
        </div>

        <div className="absolute top-4 left-4">
          <div className="relative">
            <button
              onClick={handleMenuToggle}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white hover:text-gray-300"
            >
              <span className="material-icons text-xl">more_horiz</span>
            </button>

            {showMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-2 z-50">
                <button
                  onClick={handleAddToPlaylist}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Add to playlist
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                  Share playlist
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                  Follow playlist
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-white truncate">{playlist.name}</h3>
        <p className="text-sm text-gray-400 truncate">
          {playlist.total_tracks} tracks • {formatDuration(playlist.total_duration)}
        </p>
        {playlist.description && (
          <p className="text-xs text-gray-500 truncate">
            {playlist.description}
          </p>
        )}
      </div>
    </div>
  );
}

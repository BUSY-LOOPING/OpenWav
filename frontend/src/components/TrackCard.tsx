import { useEffect, useState } from "react";
import type { Track } from "../index";

interface TrackCardProps {
  track: Track;
  onPlay?: (track: Track) => void;
  onLike?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
}

export default function TrackCard({
  track,
  onPlay,
  onLike,
  onAddToPlaylist,
}: TrackCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) onPlay(track);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    if (onLike) onLike(track);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToPlaylist) onAddToPlaylist(track);
    setShowMenu(false);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  useEffect(() => {
  }, []);

  return (
    <div
      className="card p-4 relative group"
      style={{ backgroundColor: "#181818" }}
    >
      <div className="relative">
        {imageError ? (
          <div className="w-full h-48 bg-gray-700 rounded-md mb-4 flex items-center justify-center">
            <span className="material-icons text-gray-500 text-4xl">
              music_note
            </span>
          </div>
        ) : (
          <img
            alt={`Album art for ${track.title}`}
            className="w-full h-48 object-cover rounded-md mb-4"
            src={track.albumArt}
            onError={handleImageError}
          />
        )}

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
                  Share
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                  Go to artist
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                  View album
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track Information */}
      <div className="space-y-1">
        <h3 className="font-bold text-white truncate">{track.title}</h3>
        <p className="text-sm text-gray-400 truncate">
          {track.type === "playlist" ? "Playlist" : track.artist}
          {track.views && ` • ${track.views}`}
          {track.tracks && ` • ${track.tracks}`}
        </p>
      </div>
    </div>
  );
}

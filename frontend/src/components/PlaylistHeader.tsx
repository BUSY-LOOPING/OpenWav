import type { PlaylistDetails } from "../index";
import PlaylistControls from "./PlaylistControls";

interface PlaylistHeaderProps {
  playlist: PlaylistDetails;
}

export default function PlaylistHeader({ playlist }: PlaylistHeaderProps) {
  return (
    <div className="relative p-[5rem]">
      <div className="flex flex-col items-center mb-4">
        <div className="flex-shrink-0 mb-8">
          <img
            src={playlist.coverImage}
            alt={playlist.name}
            className="w-60 h-60 rounded-lg shadow-2xl"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <h1 className="text-[3rem] font-semibold text-white mb-6 leading-tight">
            {playlist.name}
          </h1>

          {playlist.description && (
            <p className="text-white/70 text-base mb-4 max-w-2xl">
              {playlist.description}
            </p>
          )}

          <div className="flex items-center gap-[0.3rem] text-sm text-white/70">
            <img
              src={playlist.creatorAvatar}
              alt={playlist.creator}
              className="w-6 h-6 rounded-full"
            />
            <span className="font-medium text-white">{playlist.creator}</span>
            <span>•</span>
            <span>{playlist.followers} followers</span>
            <span>•</span>
            <span>{playlist.trackCount} songs,</span>
            <span className="text-white/50">{playlist.totalDuration}</span>
          </div>
        </div>
      </div>
      <PlaylistControls />
    </div>
  );
}

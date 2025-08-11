import { useState } from "react";
import type { PlaylistTrack } from "../index";

interface TrackListItemProps {
  track: PlaylistTrack;
  index: number;
}

export default function TrackListItem({ track, index }: TrackListItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(track.isLiked || false);

  return (
    <div 
      className="grid grid-cols-12 gap-4 px-4 py-2 hover:bg-white/10 rounded-md group transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Track Number / Play Button */}
      <div className="col-span-1 flex items-center justify-center text-white/50">
        {isHovered ? (
          <button className="hover:text-white">
            <span className="material-icons">play_arrow</span>
          </button>
        ) : (
          <span className="text-sm">{index}</span>
        )}
      </div>
      
      {/* Title and Artist */}
      <div className="col-span-5 flex items-center space-x-3">
        <img 
          src={track.albumArt} 
          alt={track.title}
          className="w-10 h-10 rounded"
        />
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{track.title}</p>
          <p className="text-white/50 text-sm truncate">{track.artist}</p>
        </div>
      </div>
      
      {/* Album */}
      <div className="col-span-3 flex items-center">
        <p className="text-white/50 text-sm truncate hover:text-white hover:underline cursor-pointer">
          {track.album}
        </p>
      </div>
      
      {/* Date Added */}
      <div className="col-span-2 flex items-center">
        <p className="text-white/50 text-sm">{track.dateAdded}</p>
      </div>
      
      {/* Duration and Like */}
      <div className="col-span-1 flex items-center justify-center space-x-4">
        <button 
          onClick={() => setIsLiked(!isLiked)}
          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
            isLiked ? 'text-green-500 opacity-100' : 'text-white/50 hover:text-white'
          }`}
        >
          <span className="material-icons text-base">
            {isLiked ? 'favorite' : 'favorite_border'}
          </span>
        </button>
        <span className="text-white/50 text-sm">{track.duration}</span>
        <button className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition-opacity">
          <span className="material-icons text-base">more_horiz</span>
        </button>
      </div>
    </div>
  );
}

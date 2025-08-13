import { useState } from "react";

interface Track {
  id: string;
  title: string;
  description?: string;
  url?: string;
  platform?: string;
  duration?: number;
  thumbnailPath?: string;
  likesCount?: number;
  userLiked?: boolean;
  uploaderUsername?: string;
  createdAt?: string;
  metadata?: {
    tags?: string[];
    extractor?: string;
    categories?: string[];
    webpage_url?: string;
  };
  position?: number;
  added_at?: string;
}

interface TrackListItemProps {
  track: Track;
  index: number;
}

export default function TrackListItem({ track, index }: TrackListItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(track.userLiked || false);
  const BACKEND_URL = import.meta.env.EXPRESS_BACKEND_URL || "http://localhost:3001";

  // Helper functions
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const getThumbnailUrl = (thumbnailPath?: string) => {
    if (!thumbnailPath) return "/default-album-art.jpg";
    if (thumbnailPath.startsWith('http')) return thumbnailPath;
    return `${BACKEND_URL}/${thumbnailPath}`;
  };

  const getArtist = () => {
    const firstTag = track.metadata?.tags?.[0];
    if (firstTag) return firstTag;
    if (track.uploaderUsername) return track.uploaderUsername;
    return "-";
  };

  const getAlbum = () => {
    const categories = track.metadata?.categories;
    if (categories?.length) return categories[0];
    if (track.platform) return track.platform.charAt(0).toUpperCase() + track.platform.slice(1);
    return "-";
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Playing track:", track.title);
    if (track.url) {
      window.open(track.url, '_blank');
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    console.log(isLiked ? "Unliked:" : "Liked:", track.title);
  };

  const handleMoreOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("More options for:", track.title);
  };

  const handleAlbumClick = () => {
    console.log("Navigate to album:", getAlbum());
  };

  return (
    <div 
      className="grid grid-cols-12 gap-4 px-4 py-2 hover:bg-white/10 rounded-md group transition-colors cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="col-span-1 flex items-center justify-center text-white/50">
        {isHovered ? (
          <button 
            onClick={handlePlay}
            className="hover:text-white transition-colors"
          >
            <span className="material-icons">play_arrow</span>
          </button>
        ) : (
          <span className="text-sm">{track.position || index}</span>
        )}
      </div>
      
      <div className="col-span-5 flex items-center space-x-3">
        <img 
          src={getThumbnailUrl(track.thumbnailPath)} 
          alt={track.title}
          className="w-10 h-10 rounded object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/default-album-art.jpg";
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-white font-medium truncate">{track.title || "-"}</p>
          <p className="text-white/50 text-sm truncate">{getArtist()}</p>
        </div>
      </div>
      
      <div className="col-span-3 flex items-center">
        <p 
          className="text-white/50 text-sm truncate hover:text-white hover:underline cursor-pointer"
          onClick={handleAlbumClick}
        >
          {getAlbum()}
        </p>
      </div>
      
      <div className="col-span-2 flex items-center">
        <p className="text-white/50 text-sm">
          {formatDate(track.added_at || track.createdAt)}
        </p>
      </div>
      
      <div className="col-span-1 flex items-center justify-center space-x-2">
        <button 
          onClick={handleLike}
          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
            isLiked ? 'text-green-500 opacity-100' : 'text-white/50 hover:text-white'
          }`}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <span className="material-icons text-base">
            {isLiked ? 'favorite' : 'favorite_border'}
          </span>
        </button>
        
        <span className="text-white/50 text-sm min-w-[2.5rem] text-center">
          {formatDuration(track.duration)}
        </span>
        
        <button 
          onClick={handleMoreOptions}
          className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-white transition-opacity"
          title="More options"
        >
          <span className="material-icons text-base">more_horiz</span>
        </button>
      </div>
    </div>
  );
}

import TrackListItem from "./TrackListItem";

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

interface TrackListProps {
  tracks: Track[];
}

export default function TrackList({ tracks }: TrackListProps) {
  return (
    <div className="rounded-lg">
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-white/50 border-b border-white/10">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">TITLE</div>
        <div className="col-span-3">ALBUM</div>
        <div className="col-span-2">DATE ADDED</div>
        <div className="col-span-1 text-center">
          <span className="material-icons text-base">schedule</span>
        </div>
      </div>
      
      <div>
        {tracks?.length > 0 ? (
          tracks.map((track, index) => (
            <TrackListItem 
              key={track.id} 
              track={track} 
              index={index + 1}
            />
          ))
        ) : (
          <div className="text-center text-white/50 py-8">
            No tracks available
          </div>
        )}
      </div>
    </div>
  );
}

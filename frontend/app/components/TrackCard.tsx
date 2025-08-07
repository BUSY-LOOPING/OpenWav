import type { Track } from "../index";

interface TrackCardProps {
  track: Track;
}

export default function TrackCard({ track }: TrackCardProps) {
  return (
    <div className="card p-4 relative group" style={{ backgroundColor: '#181818' }}>
      <img 
        alt={`Album art for ${track.title}`} 
        className="w-full h-auto rounded-md mb-4" 
        src={track.albumArt}
      />
      <div className="absolute bottom-20 right-6">
        <button className="play-button bg-white text-black rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-12 h-12 flex items-center justify-center">
          <span className="material-icons text-2xl">play_arrow</span>
        </button>
      </div>
      <h3 className="font-bold">{track.title}</h3>
      <p className="text-sm text-gray-400">
        {track.type === 'playlist' ? 'Playlist' : track.artist}
        {track.views && ` • ${track.views}`}
        {track.tracks && ` • ${track.tracks}`}
      </p>
    </div>
  );
}

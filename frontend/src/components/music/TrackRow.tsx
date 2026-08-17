import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { playTrack } from '../../store/slices/playerSlice';
import { formatTime } from '../../utils/mediaConverter';
import { buildThumbnailUrl } from '../../utils/mediaConverter';
import type { PlaylistTrack } from '../../types/playlist';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface TrackRowProps {
  track: PlaylistTrack;
  index: number;
  allTracks: PlaylistTrack[];
}

export function TrackRow({ track, index, allTracks }: TrackRowProps) {
  const dispatch = useDispatch<AppDispatch>();

  const thumbnail = buildThumbnailUrl(track.thumbnailPath) ?? '';
  const artist = track.metadata?.uploader ?? '';
  const album  = track.metadata?.album ?? '';

  function handlePlay() {
    dispatch(playTrack({
      track: {
        id: track.id,
        title: track.title,
        subtitle: artist,
        thumbnail,
      },
      queue: allTracks.map(t => ({
        id: t.id,
        title: t.title,
        subtitle: t.metadata?.uploader ?? '',
        thumbnail: buildThumbnailUrl(t.thumbnailPath),
      })),
    }));
  }

  return (
  <div
    className="flex items-center gap-3 px-4 py-2 rounded-md cursor-pointer group hover:bg-white/[0.05] transition-colors w-full min-w-0"
    onDoubleClick={handlePlay}
  >
    <span className="w-5 text-right text-sm text-[#aaa] group-hover:hidden shrink-0">
      {index}
    </span>
    <button
      onClick={handlePlay}
      className="w-5 hidden group-hover:flex items-center justify-center shrink-0"
    >
      <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>

    {thumbnail ? (
      <img src={thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
    ) : (
      <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center bg-[#2a2a2a]">
        <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" className="w-5 h-5">
          <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h3V3h-6z" />
        </svg>
      </div>
    )}

    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-white truncate leading-tight">{track.title}</p>
      {artist && (
        <p className="text-xs text-[#aaa] truncate mt-0.5">{artist}</p>
      )}
    </div>

    <p className="hidden lg:block text-sm text-[#aaa] truncate shrink-0 max-w-[140px]">{album}</p>

    <p className="hidden xl:block text-sm text-[#aaa] shrink-0">
      {formatDate(track.addedAt)}
    </p>

    <span className="text-sm text-[#aaa] shrink-0">
      {formatTime(track.duration ?? 0)}
    </span>

    <button className="hidden sm:block opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0">
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
      </svg>
    </button>

    <button className="sm:hidden opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0">
      <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>more_vert</span>
    </button>
  </div>
);
}
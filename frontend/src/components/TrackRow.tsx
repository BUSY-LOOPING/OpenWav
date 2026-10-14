import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { TrackMenu } from './TrackMenu';
import { Icon, IconButton, Thumb } from './ui';
import { formatTime } from '../lib/format';
import { useToggleLike } from '../lib/queries';
import type { Track } from '../lib/types';
import { playTracks, togglePlay } from '../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector } from '../store';

interface TrackRowProps {
  track: Track;
  tracks: Track[];
  index: number;
  numbered?: boolean;
  showAlbum?: boolean;
  onRemove?: () => void;
  drag?: {
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
  };
}

export function TrackRow({ track, tracks, index, numbered = false, showAlbum = true, onRemove, drag }: TrackRowProps) {
  const dispatch = useAppDispatch();
  const current = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const like = useToggleLike();
  const isCurrent = current?.id === track.id;

  const play = () => (isCurrent ? dispatch(togglePlay()) : dispatch(playTracks({ tracks, startIndex: index })));

  return (
    <div
      role="row"
      draggable={!!drag}
      {...drag}
      onDoubleClick={play}
      className={`group flex min-h-14 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/10 sm:px-3 ${isCurrent ? 'bg-white/5' : ''}`}
    >
      {drag && <Icon name="drag_indicator" className="hidden cursor-grab text-white/40 sm:inline-block" />}
      {numbered && <span className="hidden w-6 shrink-0 text-center text-sm text-muted sm:block">{index + 1}</span>}
      <button type="button" onClick={play} aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`} className="relative h-10 w-10 shrink-0 overflow-hidden rounded sm:h-12 sm:w-12">
        <Thumb src={track.thumbnailUrl} alt="" className="h-full w-full" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <Icon name={isCurrent && isPlaying ? 'pause' : 'play_arrow'} fill />
        </span>
      </button>
      <div className="min-w-0 flex-1 cursor-default" onClick={play}>
        <p className={`truncate text-sm font-medium ${isCurrent ? 'text-white' : ''}`}>{track.title}</p>
        <p className="truncate text-sm text-muted">
          {track.artists.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link to={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                {a.name}
              </Link>
            </span>
          ))}
          {track.album && <span className="lg:hidden"> • {track.album.name}</span>}
        </p>
      </div>
      {showAlbum && (
        <Link to={track.album ? `/album/${track.album.id}` : '#'} className="hidden w-1/4 truncate text-sm text-muted hover:underline lg:block">
          {track.album?.name ?? ''}
        </Link>
      )}
      <IconButton
        icon="thumb_up"
        fill={track.liked}
        label={track.liked ? 'Unlike' : 'Like'}
        onClick={() => like.mutate({ id: track.id, liked: !track.liked })}
        className={`${track.liked ? '' : 'hidden opacity-0 group-hover:opacity-100 sm:inline-flex'}`}
      />
      <span className="hidden w-12 text-right text-sm text-muted tabular-nums sm:block">{formatTime(track.durationSec)}</span>
      <TrackMenu track={track} onRemove={onRemove} />
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="h-12 w-12 animate-pulse rounded bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

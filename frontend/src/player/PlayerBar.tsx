import { TrackMenu } from '../components/TrackMenu';
import { IconButton, Thumb } from '../components/ui';
import { formatTime } from '../lib/format';
import { useToggleLike } from '../lib/queries';
import { cycleRepeat, next, prev, seek, setNowPlayingOpen, setVolume, toggleMute, togglePlay, toggleShuffle } from '../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector } from '../store';

export function SeekBar({ className = '' }: { className?: string }) {
  const dispatch = useAppDispatch();
  const position = useAppSelector((s) => s.player.position);
  const duration = useAppSelector((s) => s.player.duration);
  const fill = duration ? (position / duration) * 100 : 0;
  return (
    <input
      type="range"
      aria-label="Seek"
      min={0}
      max={duration || 0}
      step={1}
      value={Math.min(position, duration || 0)}
      onChange={(e) => dispatch(seek(Number(e.target.value)))}
      className={`range seek w-full ${className}`}
      style={{ '--fill': `${fill}%` } as React.CSSProperties}
    />
  );
}

export function TransportControls({ large = false }: { large?: boolean }) {
  const dispatch = useAppDispatch();
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const shuffle = useAppSelector((s) => s.player.shuffle);
  const repeat = useAppSelector((s) => s.player.repeat);
  const size = large ? 36 : 28;
  return (
    <div className={`flex items-center justify-center ${large ? 'gap-1 sm:gap-3' : 'gap-2 lg:gap-4'}`}>
      <IconButton icon="shuffle" label={shuffle ? 'Shuffle on' : 'Shuffle off'} onClick={() => dispatch(toggleShuffle())} className={shuffle ? 'text-white' : 'text-white/50'} />
      <IconButton icon="skip_previous" fill label="Previous" size={size} onClick={() => dispatch(prev())} />
      <IconButton
        icon={isPlaying ? 'pause' : 'play_arrow'}
        fill
        label={isPlaying ? 'Pause' : 'Play'}
        size={large ? 56 : 32}
        onClick={() => dispatch(togglePlay())}
        className={large ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 hover:bg-white/20'}
      />
      <IconButton icon="skip_next" fill label="Next" size={size} onClick={() => dispatch(next())} />
      <IconButton
        icon={repeat === 'one' ? 'repeat_one' : 'repeat'}
        label={`Repeat ${repeat}`}
        onClick={() => dispatch(cycleRepeat())}
        className={repeat === 'off' ? 'text-white/50' : 'text-white'}
      />
    </div>
  );
}

export function PlayerBar() {
  const dispatch = useAppDispatch();
  const track = useAppSelector(selectCurrentTrack);
  const position = useAppSelector((s) => s.player.position);
  const duration = useAppSelector((s) => s.player.duration);
  const volume = useAppSelector((s) => s.player.volume);
  const muted = useAppSelector((s) => s.player.muted);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const open = useAppSelector((s) => s.player.nowPlayingOpen);
  const like = useToggleLike();
  if (!track) return null;
  const effectiveVolume = muted ? 0 : volume;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 bg-surface md:bottom-0" aria-label="Player">
      <SeekBar className="absolute -top-[2px] left-0 h-1" />
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 sm:h-[72px] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:px-4">
        <button type="button" onClick={() => dispatch(setNowPlayingOpen(!open))} className="flex min-w-0 items-center gap-3 text-left" aria-label={open ? 'Close now playing' : 'Open now playing'} aria-expanded={open}>
          <Thumb src={track.thumbnailUrl} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium sm:text-base">{track.title}</span>
            <span className="block truncate text-xs text-muted sm:text-sm">
              {track.artists.map((a) => a.name).join(', ')}
              {track.album ? ` • ${track.album.name}` : ''}
            </span>
          </span>
        </button>
        <div className="hidden sm:block">
          <TransportControls />
        </div>
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <span className="hidden text-sm text-muted tabular-nums lg:inline">
            {formatTime(position)} / {formatTime(duration)}
          </span>
          <span className="hidden rounded-full bg-white/10 sm:inline-flex">
            <IconButton icon="thumb_up" fill={track.liked} label={track.liked ? 'Unlike' : 'Like'} onClick={() => like.mutate({ id: track.id, liked: !track.liked })} />
          </span>
          <div className="group hidden items-center md:flex">
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={effectiveVolume}
              onChange={(e) => dispatch(setVolume(Number(e.target.value)))}
              className="range w-0 opacity-0 transition-all group-focus-within:w-20 group-focus-within:opacity-100 group-hover:w-20 group-hover:opacity-100"
              style={{ '--fill': `${effectiveVolume * 100}%` } as React.CSSProperties}
            />
            <IconButton icon={effectiveVolume === 0 ? 'volume_off' : effectiveVolume < 0.5 ? 'volume_down' : 'volume_up'} label={muted ? 'Unmute' : 'Mute'} onClick={() => dispatch(toggleMute())} />
          </div>
          <TrackMenu track={track} className="hidden sm:inline-flex" />
          <IconButton icon={isPlaying ? 'pause' : 'play_arrow'} fill label={isPlaying ? 'Pause' : 'Play'} size={32} onClick={() => dispatch(togglePlay())} className="sm:hidden" />
          <IconButton icon="skip_next" fill label="Next" onClick={() => dispatch(next())} className="sm:hidden" />
        </div>
      </div>
    </div>
  );
}

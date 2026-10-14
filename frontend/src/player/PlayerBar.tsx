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
    <div className="flex items-center justify-center gap-1 sm:gap-3">
      {large && <IconButton icon="shuffle" label={shuffle ? 'Shuffle on' : 'Shuffle off'} onClick={() => dispatch(toggleShuffle())} className={shuffle ? 'text-white' : 'text-white/50'} />}
      <IconButton icon="skip_previous" fill label="Previous" size={size} onClick={() => dispatch(prev())} />
      <IconButton
        icon={isPlaying ? 'pause' : 'play_arrow'}
        fill
        label={isPlaying ? 'Pause' : 'Play'}
        size={large ? 56 : 40}
        onClick={() => dispatch(togglePlay())}
        className={large ? 'bg-white text-black hover:bg-white/90' : ''}
      />
      <IconButton icon="skip_next" fill label="Next" size={size} onClick={() => dispatch(next())} />
      {large && (
        <IconButton
          icon={repeat === 'one' ? 'repeat_one' : 'repeat'}
          label={`Repeat ${repeat}`}
          onClick={() => dispatch(cycleRepeat())}
          className={repeat === 'off' ? 'text-white/50' : 'text-white'}
        />
      )}
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
  const shuffle = useAppSelector((s) => s.player.shuffle);
  const repeat = useAppSelector((s) => s.player.repeat);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const open = useAppSelector((s) => s.player.nowPlayingOpen);
  const like = useToggleLike();
  if (!track) return null;
  const effectiveVolume = muted ? 0 : volume;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 bg-surface md:bottom-0" aria-label="Player">
      <SeekBar className="absolute -top-[2px] left-0 h-1" />
      <div className="flex h-16 items-center gap-2 px-2 sm:h-[72px] sm:px-4">
        <div className="hidden items-center sm:flex">
          <TransportControls />
          <span className="ml-2 hidden text-xs text-muted tabular-nums lg:inline">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </div>
        <button type="button" onClick={() => dispatch(setNowPlayingOpen(!open))} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:justify-center" aria-label="Open now playing">
          <Thumb src={track.thumbnailUrl} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{track.title}</span>
            <span className="block truncate text-xs text-muted sm:text-sm">
              {track.artists.map((a) => a.name).join(', ')}
              {track.album ? ` • ${track.album.name}` : ''}
            </span>
          </span>
        </button>
        <div className="hidden items-center sm:flex">
          <IconButton icon="thumb_up" fill={track.liked} label={track.liked ? 'Unlike' : 'Like'} onClick={() => like.mutate({ id: track.id, liked: !track.liked })} />
          <TrackMenu track={track} />
        </div>
        <div className="flex items-center sm:hidden">
          <IconButton icon={isPlaying ? 'pause' : 'play_arrow'} fill label={isPlaying ? 'Pause' : 'Play'} size={32} onClick={() => dispatch(togglePlay())} />
          <IconButton icon="skip_next" fill label="Next" onClick={() => dispatch(next())} />
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <div className="group flex items-center">
            <IconButton icon={effectiveVolume === 0 ? 'volume_off' : effectiveVolume < 0.5 ? 'volume_down' : 'volume_up'} label={muted ? 'Unmute' : 'Mute'} onClick={() => dispatch(toggleMute())} />
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={effectiveVolume}
              onChange={(e) => dispatch(setVolume(Number(e.target.value)))}
              className="range w-20 lg:w-24"
              style={{ '--fill': `${effectiveVolume * 100}%` } as React.CSSProperties}
            />
          </div>
          <IconButton icon={repeat === 'one' ? 'repeat_one' : 'repeat'} label={`Repeat ${repeat}`} onClick={() => dispatch(cycleRepeat())} className={repeat === 'off' ? 'text-white/50' : ''} />
          <IconButton icon="shuffle" label={shuffle ? 'Shuffle on' : 'Shuffle off'} onClick={() => dispatch(toggleShuffle())} className={shuffle ? '' : 'text-white/50'} />
          <IconButton icon={open ? 'arrow_drop_down' : 'arrow_drop_up'} fill label={open ? 'Close now playing' : 'Open now playing'} onClick={() => dispatch(setNowPlayingOpen(!open))} />
        </div>
      </div>
    </div>
  );
}

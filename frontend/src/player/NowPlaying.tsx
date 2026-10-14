import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeekBar, TransportControls } from './PlayerBar';
import { TrackMenu } from '../components/TrackMenu';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { Icon, IconButton, Spinner, Thumb } from '../components/ui';
import { formatTime } from '../lib/format';
import { useLyrics, useRelated, useToggleLike } from '../lib/queries';
import { jumpTo, moveInQueue, removeFromQueue, setNowPlayingOpen } from '../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector } from '../store';

const TABS = ['upnext', 'lyrics', 'related'] as const;
type Tab = (typeof TABS)[number];
const LABELS: Record<Tab, string> = { upnext: 'Up next', lyrics: 'Lyrics', related: 'Related' };

function UpNext() {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((s) => s.player.queue);
  const index = useAppSelector((s) => s.player.index);
  const dragFrom = useRef<number | null>(null);

  return (
    <ol aria-label="Queue" className="flex flex-col">
      {queue.map((track, i) => (
        <li
          key={`${track.id}-${i}`}
          draggable
          onDragStart={() => (dragFrom.current = i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom.current !== null) dispatch(moveInQueue({ from: dragFrom.current, to: i }));
            dragFrom.current = null;
          }}
          className={`group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/10 ${i === index ? 'bg-white/10' : ''}`}
        >
          <button type="button" onClick={() => dispatch(jumpTo(i))} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Play ${track.title}`}>
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded">
              <Thumb src={track.thumbnailUrl} className="h-full w-full" />
              {i === index && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Icon name="equalizer" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{track.title}</span>
              <span className="block truncate text-xs text-muted">{track.artists.map((a) => a.name).join(', ')}</span>
            </span>
          </button>
          <span className="text-xs text-muted tabular-nums">{formatTime(track.durationSec)}</span>
          <IconButton icon="arrow_upward" label="Move up" disabled={i === 0} onClick={() => dispatch(moveInQueue({ from: i, to: i - 1 }))} className="hidden group-hover:inline-flex" />
          <IconButton icon="arrow_downward" label="Move down" disabled={i === queue.length - 1} onClick={() => dispatch(moveInQueue({ from: i, to: i + 1 }))} className="hidden group-hover:inline-flex" />
          {i !== index && <IconButton icon="remove_circle" label="Remove from queue" onClick={() => dispatch(removeFromQueue(i))} />}
        </li>
      ))}
    </ol>
  );
}

function LyricsPanel({ id }: { id: string }) {
  const { data, isLoading } = useLyrics(id);
  const position = useAppSelector((s) => s.player.position);
  if (isLoading) return <Spinner className="mx-auto my-10" />;
  const synced = data?.synced
    ?.split('\n')
    .map((line) => {
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      return match ? { time: Number(match[1]) * 60 + Number(match[2]), text: match[3] } : null;
    })
    .filter((l): l is { time: number; text: string } => !!l);
  if (synced?.length) {
    const active = synced.findLastIndex((l) => l.time <= position);
    return (
      <div className="flex flex-col gap-3 py-4 text-xl font-bold">
        {synced.map((line, i) => (
          <p key={i} className={i === active ? 'text-white' : 'text-white/40'}>
            {line.text || '♪'}
          </p>
        ))}
      </div>
    );
  }
  if (data?.plain) return <p className="whitespace-pre-line py-4 leading-7">{data.plain}</p>;
  return <p className="py-10 text-center text-muted">Lyrics aren't available for this song</p>;
}

function RelatedPanel({ id }: { id: string }) {
  const { data, isLoading } = useRelated(id);
  if (isLoading) return <TrackRowSkeleton />;
  if (!data?.length) return <p className="py-10 text-center text-muted">Nothing related yet</p>;
  return (
    <div>
      {data.map((t, i) => (
        <TrackRow key={t.id} track={t} tracks={data} index={i} showAlbum={false} />
      ))}
    </div>
  );
}

export function NowPlaying() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.player.nowPlayingOpen);
  const track = useAppSelector(selectCurrentTrack);
  const position = useAppSelector((s) => s.player.position);
  const duration = useAppSelector((s) => s.player.duration);
  const like = useToggleLike();
  const [tab, setTab] = useState<Tab>('upnext');
  const touchStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  if (!open || !track) return null;
  const close = () => dispatch(setNowPlayingOpen(false));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="fixed inset-0 z-[200] flex flex-col bg-canvas md:absolute md:z-30 md:pb-[72px]"
      style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div
        className="flex h-14 shrink-0 items-center justify-between px-2 md:hidden"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientY)}
        onTouchMove={(e) => touchStart.current !== null && setDragY(Math.max(0, e.touches[0].clientY - touchStart.current))}
        onTouchEnd={() => {
          if (dragY > 120) close();
          setDragY(0);
          touchStart.current = null;
        }}
      >
        <IconButton icon="keyboard_arrow_down" label="Close now playing" onClick={close} size={32} />
        <div className="h-1 w-10 rounded-full bg-white/30 md:hidden" />
        <TrackMenu track={track} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 md:flex-row md:gap-12 md:overflow-hidden md:px-12 md:pt-10">
        <div className="flex flex-col items-center justify-center gap-6 md:flex-1">
          <Thumb src={track.thumbnailUrl} alt={track.title} className="aspect-square w-full max-w-[min(80vw,520px)] shadow-2xl md:max-h-[70vh] md:w-auto" rounded="rounded-lg" />
          <div className="w-full max-w-[520px] md:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold sm:text-2xl">{track.title}</h2>
                <p className="truncate text-muted">
                  {track.artists.map((a, i) => (
                    <span key={a.id}>
                      {i > 0 && ', '}
                      <Link to={`/artist/${a.id}`} onClick={close} className="hover:underline">
                        {a.name}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
              <IconButton icon="thumb_up" fill={track.liked} label={track.liked ? 'Unlike' : 'Like'} onClick={() => like.mutate({ id: track.id, liked: !track.liked })} />
            </div>
            <SeekBar className="mt-4" />
            <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
              <span>{formatTime(position)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="mt-2">
              <TransportControls large />
            </div>
          </div>
        </div>
        <div className="flex min-h-[50vh] flex-col md:min-h-0 md:w-[min(40%,560px)] md:shrink-0">
          <div role="tablist" className="sticky top-0 z-10 flex bg-canvas">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 border-b-2 py-3 text-sm font-medium uppercase tracking-wide ${tab === t ? 'border-white text-white' : 'border-white/10 text-muted hover:text-white'}`}
              >
                {LABELS[t]}
              </button>
            ))}
          </div>
          <div className="thin-scrollbar flex-1 md:overflow-y-auto">
            {tab === 'upnext' && <UpNext />}
            {tab === 'lyrics' && <LyricsPanel id={track.id} />}
            {tab === 'related' && <RelatedPanel id={track.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

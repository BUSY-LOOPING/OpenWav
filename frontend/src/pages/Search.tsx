import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlbumCard, ArtistCard, PlaylistCard } from '../components/Card';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { toast } from '../lib/toast';
import { Chips, Icon, IconButton, Status, Thumb } from '../components/ui';
import { errorMessage, get } from '../lib/api';
import { track as trackEvent } from '../lib/events';
import { formatTime } from '../lib/format';
import { useTaskProgress } from '../lib/progress';
import { useCreateDownload, useSearch } from '../lib/queries';
import type { SearchType, Task, Track, YoutubeResult } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

const TYPES = ['all', 'songs', 'artists', 'albums', 'playlists', 'youtube'] as const;
const LABELS: Record<SearchType, string> = { all: 'All', songs: 'Songs', artists: 'Artists', albums: 'Albums', playlists: 'Playlists', youtube: 'YouTube' };
const row = 'flex gap-4 overflow-x-auto no-scrollbar';

export function YoutubeRow({ result }: { result: YoutubeResult }) {
  const dispatch = useAppDispatch();
  const download = useCreateDownload();
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = useTaskProgress(taskId ? [taskId] : [])[taskId ?? ''];

  useEffect(() => {
    if (!taskId || !progress) return;
    const playMedia = (mediaId: string) => get<Track>(`/media/${mediaId}`).then((track) => dispatch(playTracks({ tracks: [track] })));
    if (progress.status === 'completed') {
      get<Task>(`/downloads/${taskId}`)
        .then((task) => (task.mediaId ? playMedia(task.mediaId) : undefined))
        .catch((e) => toast(errorMessage(e)))
        .finally(() => setTaskId(null));
    }
    if (progress.status === 'failed' || progress.status === 'cancelled') {
      toast(progress.error ?? 'Download failed');
      setTaskId(null);
    }
  }, [progress, taskId, dispatch]);

  async function playMedia(mediaId: string) {
    const track = await get<Track>(`/media/${mediaId}`);
    dispatch(playTracks({ tracks: [track] }));
  }

  async function play() {
    try {
      if (result.mediaId) return await playMedia(result.mediaId);
      const response = await download.mutateAsync({ url: result.url });
      if (response.mediaId) return await playMedia(response.mediaId);
      if (response.taskId) setTaskId(response.taskId);
    } catch (e) {
      toast(errorMessage(e, 'Could not start download'));
    }
  }

  const busy = !!taskId || download.isPending;
  const percent = progress?.progress ?? 0;

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/10 sm:px-3">
      <button type="button" onClick={play} disabled={busy} aria-label={busy ? `Downloading ${result.title}` : `Play ${result.title}`} className="relative h-12 w-20 shrink-0 overflow-hidden rounded">
        <Thumb src={result.thumbnailUrl} className="h-full w-full" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${busy ? '' : 'opacity-0 group-hover:opacity-100'}`}>
          {busy ? <span className="text-xs font-bold tabular-nums">{Math.round(percent)}%</span> : <Icon name={result.downloaded ? 'play_arrow' : 'download'} fill />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{result.title}</p>
        <p className="truncate text-sm text-muted">
          {result.channel}
          {result.durationSec ? ` • ${formatTime(result.durationSec)}` : ''}
          {busy ? ` • ${progress?.status ?? 'queued'}` : result.downloaded ? ' • In library' : ''}
        </p>
        {busy && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <IconButton icon="open_in_new" label="Open on YouTube" onClick={() => window.open(result.url, '_blank', 'noopener')} className="hidden sm:inline-flex" />
    </div>
  );
}

function Block({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {onMore && (
          <button type="button" onClick={onMore} className="rounded-full border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
            More
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = (TYPES as readonly string[]).includes(params.get('type') ?? '') ? (params.get('type') as SearchType) : 'all';
  const { data, isLoading, isError } = useSearch(q, type);
  const setType = (t: SearchType) => setParams({ q, type: t });

  useEffect(() => {
    if (q.trim()) trackEvent({ type: 'search', query: q.trim().slice(0, 200) });
  }, [q]);

  const empty = data && !data.songs.length && !data.artists.length && !data.albums.length && !data.playlists.length && !data.youtube.length;
  const limit = (n: number) => (type === 'all' ? n : undefined);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-8">
      <Chips options={TYPES} value={type} labels={LABELS} onChange={setType} className="mb-6" />
      {!q && <Status icon="search" title="Search for songs, artists, albums and playlists" />}
      {isLoading && Array.from({ length: 6 }, (_, i) => <TrackRowSkeleton key={i} />)}
      {isError && <Status icon="error" title="Search failed" message="Try again in a moment." />}
      {empty && <Status icon="search_off" title={`No results for "${q}"`} message="Check the spelling or try the YouTube tab to download something new." />}
      {data && (
        <>
          {!!data.songs.length && (
            <Block title="Songs" onMore={type === 'all' ? () => setType('songs') : undefined}>
              {data.songs.slice(0, limit(4)).map((t, i) => (
                <TrackRow key={t.id} track={t} tracks={data.songs} index={i} />
              ))}
            </Block>
          )}
          {!!data.youtube.length && (
            <Block title="From YouTube" onMore={type === 'all' ? () => setType('youtube') : undefined}>
              {data.youtube.slice(0, limit(4)).map((r) => (
                <YoutubeRow key={r.videoId} result={r} />
              ))}
            </Block>
          )}
          {!!data.artists.length && (
            <Block title="Artists" onMore={type === 'all' ? () => setType('artists') : undefined}>
              <div className={type === 'all' ? row : 'grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6'}>
                {data.artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </div>
            </Block>
          )}
          {!!data.albums.length && (
            <Block title="Albums" onMore={type === 'all' ? () => setType('albums') : undefined}>
              <div className={type === 'all' ? row : 'grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6'}>
                {data.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </Block>
          )}
          {!!data.playlists.length && (
            <Block title="Playlists" onMore={type === 'all' ? () => setType('playlists') : undefined}>
              <div className={type === 'all' ? row : 'grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6'}>
                {data.playlists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </div>
            </Block>
          )}
        </>
      )}
    </div>
  );
}

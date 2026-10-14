import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlbumCard, ArtistCard, Card, PlaylistCard } from '../components/Card';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { toast } from '../lib/toast';
import { Button, Chips, Icon, IconButton, Status, Thumb } from '../components/ui';
import { errorMessage, get, send } from '../lib/api';
import { track as trackEvent } from '../lib/events';
import { formatTime } from '../lib/format';
import { useTaskProgress } from '../lib/progress';
import { keys, useCreateDownload, useSearch } from '../lib/queries';
import type { OnlineAlbum, OnlineArtist, OnlinePlaylist, OnlineResults, SearchScope, SearchType, Task, Track, YoutubeResult } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

const ONLINE_TYPES = ['all', 'songs', 'videos', 'albums', 'artists', 'playlists'] as const;
const LIBRARY_TYPES = ['all', 'songs', 'albums', 'artists', 'playlists'] as const;
const LABELS: Record<SearchType, string> = { all: 'All', songs: 'Songs', videos: 'Videos', albums: 'Albums', artists: 'Artists', playlists: 'Community playlists' };
const ROW = 'flex gap-4 overflow-x-auto no-scrollbar';
const GRID = 'grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6';

const ytFallback = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
const subtitleOf = (r: YoutubeResult) =>
  [r.type === 'video' ? 'Video' : 'Song', r.artists?.length ? r.artists.join(', ') : r.channel, r.views && `${r.views} ${r.type === 'video' ? 'views' : 'plays'}`, r.durationSec && formatTime(r.durationSec)]
    .filter(Boolean)
    .join(' • ');

function usePlayResult(result: YoutubeResult) {
  const dispatch = useAppDispatch();
  const download = useCreateDownload();
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = useTaskProgress(taskId ? [taskId] : [])[taskId ?? ''];
  const playMedia = (mediaId: string) => get<Track>(`/media/${mediaId}`).then((t) => dispatch(playTracks({ tracks: [t] })));

  useEffect(() => {
    if (!taskId || !progress) return;
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
  }, [progress, taskId]);

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

  return { play, busy: !!taskId || download.isPending, percent: progress?.progress ?? 0, status: progress?.status };
}

function useImport() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (url: string | null, name: string) => {
    if (!url) return toast('This album cannot be imported');
    try {
      const { playlistId } = await send<{ playlistId: string }>('post', '/playlists/import', { url, name });
      qc.invalidateQueries({ queryKey: keys.myPlaylists });
      toast(`Importing ${name}`);
      navigate(`/playlist/${playlistId}`);
    } catch (e) {
      toast(errorMessage(e, 'Import failed'));
    }
  };
}

export function YoutubeRow({ result }: { result: YoutubeResult }) {
  const { play, busy, percent, status } = usePlayResult(result);
  const wide = result.type === 'video';

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/10 sm:px-3">
      <button type="button" onClick={play} disabled={busy} aria-label={busy ? `Downloading ${result.title}` : `Play ${result.title}`} className={`relative h-12 shrink-0 overflow-hidden rounded ${wide ? 'w-20' : 'w-12'}`}>
        <Thumb src={result.thumbnailUrl} fallback={ytFallback(result.videoId)} className="h-full w-full" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${busy ? '' : 'opacity-0 group-hover:opacity-100'}`}>
          {busy ? <span className="text-xs font-bold tabular-nums">{Math.round(percent)}%</span> : <Icon name="play_arrow" fill />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{result.title}</p>
        <p className="truncate text-sm text-muted">
          {subtitleOf(result)}
          {busy ? ` • ${status ?? 'queued'}` : result.downloaded ? ' • In library' : ''}
        </p>
        {busy && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <IconButton icon="open_in_new" label="Open on YouTube" onClick={() => window.open(result.url, '_blank', 'noopener')} className="hidden opacity-0 group-hover:opacity-100 sm:inline-flex" />
    </div>
  );
}

function PlayButton({ result }: { result: YoutubeResult }) {
  const { play, busy, percent } = usePlayResult(result);
  return (
    <Button onClick={play} disabled={busy}>
      <Icon name="play_arrow" fill /> {busy ? `${Math.round(percent)}%` : 'Play'}
    </Button>
  );
}

function TopResult({ item, onArtist }: { item: OnlineResults['top']; onArtist: (name: string) => void }) {
  const runImport = useImport();
  if (!item) return null;
  const song = item.type === 'song' || item.type === 'video' ? item : null;

  const art =
    item.type === 'artist' ? (
      <Thumb src={item.thumbnailUrl} icon="person" rounded="rounded-full" className="h-24 w-24 sm:h-28 sm:w-28" />
    ) : (
      <Thumb src={item.thumbnailUrl} fallback={song ? ytFallback(song.videoId) : null} className={`h-24 sm:h-28 ${item.type === 'video' ? 'aspect-video' : 'w-24 sm:w-28'}`} />
    );
  const title = item.type === 'artist' ? item.name : item.title;
  const subtitle = item.type === 'album' ? [item.albumType ?? 'Album', item.artists.join(', '), item.year].filter(Boolean).join(' • ') : item.type === 'artist' ? 'Artist' : subtitleOf(item);
  const action =
    item.type === 'artist' ? (
      <Button onClick={() => onArtist(item.name)}>
        <Icon name="shuffle" /> Songs
      </Button>
    ) : item.type === 'album' ? (
      <Button onClick={() => runImport(item.url, item.title)}>
        <Icon name="download" /> Import
      </Button>
    ) : (
      <PlayButton result={item} />
    );

  return (
    <section aria-label="Top result" className="mb-8 flex flex-col gap-4 rounded-xl bg-gradient-to-r from-white/10 to-white/[0.03] p-4 sm:flex-row sm:items-center sm:p-6">
      {art}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xl font-bold sm:text-2xl">{title}</p>
        <p className="mt-1 truncate text-muted">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {action}
        {item.url && (
          <Button variant="secondary" onClick={() => window.open(item.url!, '_blank', 'noopener')}>
            <Icon name="open_in_new" /> YouTube
          </Button>
        )}
      </div>
    </section>
  );
}

function Block({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        {onMore && (
          <button type="button" onClick={onMore} className="rounded-full border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
            Show all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function OnlineAlbumCard({ album }: { album: OnlineAlbum }) {
  const runImport = useImport();
  return <Card title={album.title} subtitle={[album.albumType ?? 'Album', album.artists.join(', '), album.year].filter(Boolean).join(' • ')} images={[album.thumbnailUrl]} onPlay={() => runImport(album.url, album.title)} />;
}

function OnlinePlaylistCard({ playlist }: { playlist: OnlinePlaylist }) {
  const runImport = useImport();
  return (
    <Card
      title={playlist.title}
      subtitle={[playlist.author, playlist.itemCount && `${playlist.itemCount} songs`].filter(Boolean).join(' • ')}
      images={[playlist.thumbnailUrl]}
      icon="queue_music"
      onPlay={() => runImport(playlist.url, playlist.title)}
    />
  );
}

function OnlineArtistCard({ artist }: { artist: OnlineArtist }) {
  return <Card title={artist.name} subtitle="Artist" images={[artist.thumbnailUrl]} circle icon="person" href={`/search?q=${encodeURIComponent(artist.name)}&type=songs`} />;
}

function Tabs({ scope, onChange }: { scope: SearchScope; onChange: (s: SearchScope) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-8 border-b border-white/10">
      {(['online', 'library'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={scope === s}
          onClick={() => onChange(s)}
          className={`-mb-px border-b-2 pb-3 text-sm font-medium uppercase tracking-wide ${scope === s ? 'border-white text-white' : 'border-transparent text-muted hover:text-white'}`}
        >
          {s === 'online' ? 'YT Music' : 'Library'}
        </button>
      ))}
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const scope: SearchScope = params.get('scope') === 'library' ? 'library' : 'online';
  const types: readonly SearchType[] = scope === 'online' ? ONLINE_TYPES : LIBRARY_TYPES;
  const type = (types as readonly string[]).includes(params.get('type') ?? '') ? (params.get('type') as SearchType) : 'all';
  const { data, isLoading, isError } = useSearch(q, scope, type);
  const set = (next: { scope?: SearchScope; type?: SearchType; q?: string }) =>
    setParams({ q: next.q ?? q, ...((next.scope ?? scope) === 'library' ? { scope: 'library' } : {}), ...((next.type ?? type) !== 'all' ? { type: next.type ?? type } : {}) });
  const more = (t: SearchType) => (type === 'all' ? () => set({ type: t }) : undefined);
  const take = <T,>(items: T[], n: number) => (type === 'all' ? items.slice(0, n) : items);

  useEffect(() => {
    if (q.trim()) trackEvent({ type: 'search', query: q.trim().slice(0, 200) });
  }, [q]);

  const online = data?.online;
  const library = data?.library;
  const empty =
    (online && !online.songs.length && !online.videos.length && !online.albums.length && !online.artists.length && !online.playlists.length) ||
    (library && !library.songs.length && !library.artists.length && !library.albums.length && !library.playlists.length);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-8">
      <Tabs scope={scope} onChange={(s) => set({ scope: s, type: 'all' })} />
      <Chips options={types} value={type} labels={LABELS} onChange={(t) => set({ type: t })} className="mb-6" />
      {!q && <Status icon="search" title="Search for songs, artists, albums and playlists" />}
      {isLoading && Array.from({ length: 6 }, (_, i) => <TrackRowSkeleton key={i} />)}
      {isError && <Status icon="error" title="Search failed" message="Try again in a moment." />}
      {empty && (
        <Status
          icon="search_off"
          title={`No results for "${q}"`}
          message={scope === 'library' ? 'Nothing in your library matches. Try the YT Music tab.' : 'Check the spelling or try a different filter.'}
        />
      )}

      {online && (
        <>
          {type === 'all' && <TopResult item={online.top} onArtist={(name) => set({ q: name, type: 'songs' })} />}
          {!!online.songs.length && (
            <Block title="Songs" onMore={more('songs')}>
              {take(online.songs, 4).map((r) => (
                <YoutubeRow key={r.videoId} result={r} />
              ))}
            </Block>
          )}
          {!!online.videos.length && (
            <Block title="Videos" onMore={more('videos')}>
              {take(online.videos, 3).map((r) => (
                <YoutubeRow key={r.videoId} result={r} />
              ))}
            </Block>
          )}
          {!!online.albums.length && (
            <Block title="Albums" onMore={more('albums')}>
              <div className={type === 'all' ? ROW : GRID}>
                {online.albums.map((a) => (
                  <OnlineAlbumCard key={a.browseId} album={a} />
                ))}
              </div>
            </Block>
          )}
          {!!online.artists.length && (
            <Block title="Artists" onMore={more('artists')}>
              <div className={type === 'all' ? ROW : GRID}>
                {online.artists.map((a) => (
                  <OnlineArtistCard key={a.browseId} artist={a} />
                ))}
              </div>
            </Block>
          )}
          {!!online.playlists.length && (
            <Block title="Community playlists" onMore={more('playlists')}>
              <div className={type === 'all' ? ROW : GRID}>
                {online.playlists.map((p) => (
                  <OnlinePlaylistCard key={p.playlistId} playlist={p} />
                ))}
              </div>
            </Block>
          )}
        </>
      )}

      {library && (
        <>
          {!!library.songs.length && (
            <Block title="Songs" onMore={more('songs')}>
              {take(library.songs, 4).map((t, i) => (
                <TrackRow key={t.id} track={t} tracks={library.songs} index={i} />
              ))}
            </Block>
          )}
          {!!library.albums.length && (
            <Block title="Albums" onMore={more('albums')}>
              <div className={type === 'all' ? ROW : GRID}>
                {library.albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </Block>
          )}
          {!!library.artists.length && (
            <Block title="Artists" onMore={more('artists')}>
              <div className={type === 'all' ? ROW : GRID}>
                {library.artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </div>
            </Block>
          )}
          {!!library.playlists.length && (
            <Block title="Playlists" onMore={more('playlists')}>
              <div className={type === 'all' ? ROW : GRID}>
                {library.playlists.map((p) => (
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

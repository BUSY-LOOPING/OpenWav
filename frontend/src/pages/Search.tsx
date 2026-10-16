import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlbumCard, ArtistCard, Card, PlaylistCard } from '../components/Card';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { YoutubeRow, subtitleOf, useImport, usePlayResult, ytFallback } from '../components/YoutubeRow';
import { Button, Chips, Icon, Status, Thumb } from '../components/ui';
import { track as trackEvent } from '../lib/events';
import { useSearch } from '../lib/queries';
import type { OnlineAlbum, OnlineArtist, OnlinePlaylist, OnlineResults, SearchScope, SearchType, YoutubeResult } from '../lib/types';

const ONLINE_TYPES = ['all', 'songs', 'videos', 'albums', 'artists', 'playlists'] as const;
const LIBRARY_TYPES = ['all', 'songs', 'albums', 'artists', 'playlists'] as const;
const LABELS: Record<SearchType, string> = { all: 'All', songs: 'Songs', videos: 'Videos', albums: 'Albums', artists: 'Artists', playlists: 'Community playlists' };
const ROW = 'flex gap-4 overflow-x-auto no-scrollbar';
const GRID = 'grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6';

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
  const navigate = useNavigate();
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
      item.playlistId ? (
        <Button onClick={() => navigate(`/youtube/playlist/${item.playlistId}`)}>
          <Icon name="album" /> View album
        </Button>
      ) : (
        <Button onClick={() => runImport(item.url, item.title)}>
          <Icon name="download" /> Import
        </Button>
      )
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
  const navigate = useNavigate();
  const href = album.playlistId ? `/youtube/playlist/${album.playlistId}` : undefined;
  return (
    <Card
      title={album.title}
      subtitle={[album.albumType ?? 'Album', album.artists.join(', '), album.year].filter(Boolean).join(' • ')}
      images={[album.thumbnailUrl]}
      icon="album"
      href={href}
      onPlay={() => (href ? navigate(`${href}?play=1`) : runImport(album.url, album.title))}
    />
  );
}

function OnlinePlaylistCard({ playlist }: { playlist: OnlinePlaylist }) {
  const navigate = useNavigate();
  const href = `/youtube/playlist/${playlist.playlistId}`;
  return (
    <Card
      title={playlist.title}
      subtitle={[playlist.author, playlist.itemCount && `${playlist.itemCount} songs`].filter(Boolean).join(' • ')}
      images={[playlist.thumbnailUrl]}
      icon="queue_music"
      href={href}
      onPlay={() => navigate(`${href}?play=1`)}
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

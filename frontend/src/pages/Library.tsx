import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlbumCard, ArtistCard, Card, PlaylistCard } from '../components/Card';
import { NewPlaylistDialog } from '../components/PlaylistDialogs';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { Button, Chips, Icon, Status } from '../components/ui';
import { loadLikedTracks, useHistory, useLibraryAlbums, useLibraryArtists, useLiked, useMyPlaylists, usePlayCollection } from '../lib/queries';
import type { Track } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

const TABS = ['playlists', 'songs', 'albums', 'artists', 'history'] as const;
type Tab = (typeof TABS)[number];
const LABELS: Record<Tab, string> = { playlists: 'Playlists', songs: 'Songs', albums: 'Albums', artists: 'Artists', history: 'History' };

const grid = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 [&>*]:w-full [&>*]:max-w-none';

function PlaylistsTab() {
  const { data, isLoading } = useMyPlaylists();
  const [creating, setCreating] = useState(false);
  const play = usePlayCollection();
  return (
    <div className={grid}>
      <button type="button" onClick={() => setCreating(true)} className="flex flex-col text-left" aria-label="New playlist">
        <span className="flex aspect-square w-full items-center justify-center rounded-md bg-white/10 hover:bg-white/20">
          <Icon name="add" size={48} />
        </span>
        <span className="mt-2 text-sm font-medium">New playlist</span>
      </button>
      <Card title="Liked music" subtitle="Auto playlist" images={[]} href="/library?tab=songs" icon="thumb_up" onPlay={() => play(loadLikedTracks)} />
      {isLoading && <TrackRowSkeleton />}
      {data?.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
      {creating && <NewPlaylistDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function PagedTracks({ query, empty }: { query: ReturnType<typeof useLiked> | ReturnType<typeof useHistory>; empty: string }) {
  const dispatch = useAppDispatch();
  const tracks: Track[] = query.data?.pages.flatMap((p) => p.data) ?? [];
  if (query.isLoading) return <>{Array.from({ length: 8 }, (_, i) => <TrackRowSkeleton key={i} />)}</>;
  if (!tracks.length) return <Status icon="music_note" title={empty} />;
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button onClick={() => dispatch(playTracks({ tracks, shuffle: false }))}>
          <Icon name="play_arrow" fill /> Play
        </Button>
        <Button variant="secondary" onClick={() => dispatch(playTracks({ tracks, shuffle: true }))}>
          <Icon name="shuffle" /> Shuffle
        </Button>
      </div>
      {tracks.map((t, i) => (
        <TrackRow key={`${t.id}-${i}`} track={t} tracks={tracks} index={i} />
      ))}
      {query.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function LikedTab() {
  return <PagedTracks query={useLiked()} empty="Songs you like will appear here" />;
}

function HistoryTab() {
  return <PagedTracks query={useHistory()} empty="Songs you play will appear here" />;
}

function AlbumsTab() {
  const { data, isLoading } = useLibraryAlbums();
  if (!isLoading && !data?.length) return <Status icon="album" title="Albums from your liked songs will appear here" />;
  return <div className={grid}>{data?.map((a) => <AlbumCard key={a.id} album={a} />)}</div>;
}

function ArtistsTab() {
  const { data, isLoading } = useLibraryArtists();
  if (!isLoading && !data?.length) return <Status icon="person" title="Artists you subscribe to will appear here" />;
  return <div className={grid}>{data?.map((a) => <ArtistCard key={a.id} artist={a} />)}</div>;
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'playlists';

  return (
    <div className="mx-auto max-w-[1478px] px-4 pt-4 sm:px-8 lg:px-12">
      <Chips options={TABS} value={tab} labels={LABELS} onChange={(t) => setParams({ tab: t })} className="mb-8" />
      {tab === 'playlists' && <PlaylistsTab />}
      {tab === 'songs' && <LikedTab />}
      {tab === 'albums' && <AlbumsTab />}
      {tab === 'artists' && <ArtistsTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

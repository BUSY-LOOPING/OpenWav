import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CollectionHeader, CollectionLayout } from '../components/CollectionHeader';
import { YoutubeRow } from '../components/YoutubeRow';
import { useImport } from '../components/youtubeResult';
import { TrackRowSkeleton } from '../components/TrackRow';
import { Button, Icon, IconButton, LoadMore, Skeleton, Status } from '../components/ui';
import { errorMessage } from '../lib/api';
import { formatDuration } from '../lib/format';
import { flat, useOnlinePlaylist, useOnlinePlaylistTracks } from '../lib/queries';

export default function OnlinePlaylist() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data: playlist, isLoading, isError, error, refetch } = useOnlinePlaylist(id);
  const tracksQuery = useOnlinePlaylistTracks(id);
  const tracks = flat(tracksQuery);
  const runImport = useImport();
  const [playSignal, setPlaySignal] = useState(params.get('play') ? 1 : 0);
  const [importing, setImporting] = useState(false);

  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <Skeleton className="mx-auto my-6 h-64 w-64" />
        {Array.from({ length: 6 }, (_, i) => (
          <TrackRowSkeleton key={i} />
        ))}
      </div>
    );
  if (isError || !playlist)
    return <Status icon="playlist_remove" title="Couldn't load this playlist" message={errorMessage(error, 'It may be private or unavailable.')} action={<Button onClick={() => refetch()}>Retry</Button>} />;

  const importAll = async () => {
    setImporting(true);
    await runImport(playlist.url, playlist.title);
    setImporting(false);
  };

  return (
    <CollectionLayout
      ambient={playlist.thumbnailUrl}
      header={
        <CollectionHeader
          cover={[playlist.thumbnailUrl]}
          title={playlist.title}
          description={playlist.description}
          meta={
            <>
              <p>{['YouTube Music', playlist.author, playlist.year].filter(Boolean).join(' • ')}</p>
              <p>
                {playlist.trackCount} songs • {formatDuration(playlist.durationSec)} • {playlist.missing ? `${playlist.missing} not downloaded` : 'all in library'}
              </p>
            </>
          }
          actions={
            <>
              <Button variant="secondary" onClick={importAll} disabled={importing || !playlist.missing}>
                <Icon name="download" /> {playlist.missing ? 'Import all' : 'Imported'}
              </Button>
              <button
                type="button"
                onClick={() => setPlaySignal((n) => n + 1)}
                disabled={!playlist.trackCount}
                aria-label="Play first song"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-40"
              >
                <Icon name="play_arrow" fill size={36} />
              </button>
              <IconButton icon="open_in_new" label="Open on YouTube" onClick={() => window.open(playlist.url, '_blank', 'noopener')} className="h-10 w-10 bg-white/10" />
            </>
          }
        />
      }
    >
      <p className="mb-3 px-2 text-sm text-muted sm:px-3">Songs download when you play them. Use the menu to queue them up or save them to your library.</p>
      {tracksQuery.isLoading && Array.from({ length: 6 }, (_, i) => <TrackRowSkeleton key={i} />)}
      {!tracksQuery.isLoading && !tracks.length && <Status icon="queue_music" title="No playable songs" />}
      <div role="table" aria-label="Songs">
        {tracks.map((t, i) => (
          <YoutubeRow key={t.position} result={t} autoPlay={i === 0 ? playSignal : 0} />
        ))}
        <LoadMore query={tracksQuery} />
      </div>
    </CollectionLayout>
  );
}

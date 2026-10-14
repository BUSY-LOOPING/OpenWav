import { Link, useParams } from 'react-router-dom';
import { CollectionHeader, PlayButtons } from '../components/CollectionHeader';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { Status } from '../components/ui';
import { formatDuration } from '../lib/format';
import { useAlbum } from '../lib/queries';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

export default function Album() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const { data: album, isLoading, isError } = useAlbum(id);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 pt-8">{Array.from({ length: 8 }, (_, i) => <TrackRowSkeleton key={i} />)}</div>;
  if (isError || !album) return <Status icon="album" title="Album not found" />;

  const total = album.tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0);

  return (
    <div className="mx-auto flex max-w-[1478px] flex-col gap-4 px-4 sm:px-8 xl:flex-row xl:gap-12 xl:px-12">
      <div className="xl:w-[380px] xl:shrink-0">
        <CollectionHeader
          cover={[album.coverUrl]}
          title={album.name}
          meta={
            <>
              <p>
                Album •{' '}
                {album.artists.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ', '}
                    <Link to={`/artist/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </span>
                ))}
                {album.releaseYear ? ` • ${album.releaseYear}` : ''}
              </p>
              <p>
                {album.tracks.length} songs • {formatDuration(total)}
              </p>
            </>
          }
          actions={<PlayButtons disabled={!album.tracks.length} onPlay={() => dispatch(playTracks({ tracks: album.tracks, shuffle: false }))} onShuffle={() => dispatch(playTracks({ tracks: album.tracks, shuffle: true }))} />}
        />
      </div>
      <div className="min-w-0 flex-1 pb-6 xl:pt-6">
        {album.tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} tracks={album.tracks} index={i} numbered showAlbum={false} />
        ))}
      </div>
    </div>
  );
}

import { useParams } from 'react-router-dom';
import { AlbumCard } from '../components/Card';
import { Carousel } from '../components/Carousel';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { Button, Icon, Status } from '../components/ui';
import { formatCount } from '../lib/format';
import { useArtist, useSubscribe } from '../lib/queries';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

export default function Artist() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const { data: artist, isLoading, isError } = useArtist(id);
  const subscribe = useSubscribe(id);

  if (isLoading) return <div className="px-4 pt-8">{Array.from({ length: 6 }, (_, i) => <TrackRowSkeleton key={i} />)}</div>;
  if (isError || !artist) return <Status icon="person_off" title="Artist not found" />;

  return (
    <div>
      <header className="relative flex min-h-[320px] items-end overflow-hidden sm:min-h-[420px]">
        {artist.imageUrl && <img src={artist.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />
        <div className="relative mx-auto w-full max-w-[1478px] px-4 pb-6 sm:px-8 lg:px-12">
          <h1 className="text-4xl font-black sm:text-6xl">{artist.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => artist.topTracks.length && dispatch(playTracks({ tracks: artist.topTracks, shuffle: true }))} disabled={!artist.topTracks.length}>
              <Icon name="shuffle" /> Shuffle
            </Button>
            <Button variant="secondary" onClick={() => subscribe.mutate(!artist.subscribed)} aria-pressed={artist.subscribed}>
              {artist.subscribed ? 'Subscribed' : 'Subscribe'} {formatCount(artist.subscriberCount)}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1478px] px-4 pt-6 sm:px-8 lg:px-12">
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl">Songs</h2>
          {!artist.topTracks.length && <p className="text-muted">No songs yet</p>}
          {artist.topTracks.map((t, i) => (
            <TrackRow key={t.id} track={t} tracks={artist.topTracks} index={i} />
          ))}
        </section>
        {!!artist.albums.length && (
          <Carousel title="Albums">
            {artist.albums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </Carousel>
        )}
      </div>
    </div>
  );
}

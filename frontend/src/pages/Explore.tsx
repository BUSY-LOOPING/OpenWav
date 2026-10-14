import { Link, useParams } from 'react-router-dom';
import { TrackCard } from '../components/Card';
import { Carousel } from '../components/Carousel';
import { TrackRow, TrackRowSkeleton } from '../components/TrackRow';
import { Button, Icon, Status } from '../components/ui';
import { CarouselSkeleton, MOODS } from './Home';
import { useExplore, useMood } from '../lib/queries';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

const MOOD_COLORS = ['#e8405c', '#4c7ff0', '#f5a623', '#7ed321', '#bd10e0', '#50e3c2', '#f8e71c', '#d0021b', '#9013fe', '#417505'];

function MoodGrid({ id, title, items, offset = 0 }: { id: string; title: string; items: readonly string[]; offset?: number }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="mb-4 text-xl font-bold sm:text-2xl">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((mood, i) => (
          <Link
            key={mood}
            to={`/explore/mood/${encodeURIComponent(mood)}`}
            className="truncate rounded-md border-l-[6px] bg-white/10 px-4 py-4 text-sm font-medium hover:bg-white/20"
            style={{ borderLeftColor: MOOD_COLORS[(i + offset) % MOOD_COLORS.length] }}
          >
            {mood}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Explore() {
  const { data, isLoading, isError, refetch } = useExplore();
  const moods = data?.moods.length ? data.moods : [...MOODS];

  return (
    <div className="mx-auto max-w-[1478px] px-4 pt-6 sm:px-8 lg:px-12">
      <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { to: '#new', icon: 'new_releases', label: 'New releases' },
          { to: '#charts', icon: 'trending_up', label: 'Charts' },
          { to: '#moods', icon: 'sentiment_satisfied', label: 'Moods & genres' },
        ].map((tile) => (
          <a key={tile.label} href={tile.to} className="flex items-center gap-4 rounded-lg bg-white/10 px-5 py-4 text-base font-medium hover:bg-white/20">
            <Icon name={tile.icon} /> {tile.label}
          </a>
        ))}
      </div>
      {isLoading && <CarouselSkeleton />}
      {isError && <Status icon="wifi_off" title="Couldn't load Explore" action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {data && (
        <>
          <div id="new">
            <Carousel title="New releases">
              {data.newReleases.map((t, i) => (
                <TrackCard key={t.id} track={t} tracks={data.newReleases} index={i} />
              ))}
            </Carousel>
          </div>
          <section id="charts" className="mb-10">
            <h2 className="mb-4 text-xl font-bold sm:text-2xl">Top songs</h2>
            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              {data.charts.slice(0, 20).map((t, i) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-6 text-center text-lg font-bold text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <TrackRow track={t} tracks={data.charts} index={i} showAlbum={false} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <MoodGrid id="moods" title="Moods and moments" items={moods} />
      {!!data?.genres.length && <MoodGrid id="genres" title="Genres" items={data.genres} offset={moods.length} />}
    </div>
  );
}

export function MoodPage() {
  const { mood = '' } = useParams();
  const dispatch = useAppDispatch();
  const { data, isLoading } = useMood(mood);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold sm:text-4xl">{mood}</h1>
        {!!data?.length && (
          <Button onClick={() => dispatch(playTracks({ tracks: data, shuffle: true }))}>
            <Icon name="shuffle" /> Shuffle
          </Button>
        )}
      </div>
      {isLoading && Array.from({ length: 8 }, (_, i) => <TrackRowSkeleton key={i} />)}
      {data?.length === 0 && <Status icon="sentiment_neutral" title={`No ${mood} songs yet`} />}
      {data?.map((t, i) => <TrackRow key={t.id} track={t} tracks={data} index={i} />)}
    </div>
  );
}

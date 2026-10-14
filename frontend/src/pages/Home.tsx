import { useNavigate } from 'react-router-dom';
import { ArtistCard, PlaylistCard, TrackCard } from '../components/Card';
import { Carousel } from '../components/Carousel';
import { TrackMenu } from '../components/TrackMenu';
import { Button, Chips, Icon, Skeleton, Status, Thumb } from '../components/ui';
import { artistNames } from '../lib/format';
import { useHome } from '../lib/queries';
import type { Section, Track } from '../lib/types';
import { playTracks } from '../store/player';
import { selectCurrentTrack, useAppDispatch, useAppSelector } from '../store';

export const MOODS = ['Chill', 'Sleep', 'Sad', 'Romance', 'Energize', 'Feel-good', 'Party', 'Focus', 'Workout', 'Commute'] as const;

function QuickPicks({ section }: { section: Extract<Section, { kind: 'quick_picks' | 'tracks' }> }) {
  const dispatch = useAppDispatch();
  const current = useAppSelector(selectCurrentTrack);
  const tracks = section.items;
  const columns: Track[][] = [];
  for (let i = 0; i < tracks.length; i += 4) columns.push(tracks.slice(i, i + 4));

  return (
    <Carousel
      title={section.title}
      subtitle={section.subtitle}
      action={
        <Button variant="secondary" onClick={() => dispatch(playTracks({ tracks, startIndex: 0 }))}>
          Play all
        </Button>
      }
    >
      {columns.map((column, c) => (
        <ul key={c} className="flex w-[85vw] max-w-[400px] shrink-0 snap-start flex-col gap-1">
          {column.map((track, r) => (
            <li key={track.id} className="group flex items-center gap-3 rounded-md pr-1 hover:bg-white/10">
              <button
                type="button"
                onClick={() => dispatch(playTracks({ tracks, startIndex: c * 4 + r }))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-label={`Play ${track.title}`}
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded">
                  <Thumb src={track.thumbnailUrl} className="h-full w-full" />
                  <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${current?.id === track.id ? '' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Icon name={current?.id === track.id ? 'equalizer' : 'play_arrow'} fill />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{track.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {artistNames(track)}
                    {track.playCount ? ` • ${track.playCount} plays` : ''}
                  </span>
                </span>
              </button>
              <TrackMenu track={track} />
            </li>
          ))}
        </ul>
      ))}
    </Carousel>
  );
}

export function SectionView({ section }: { section: Section }) {
  if (section.kind === 'quick_picks') return <QuickPicks section={section} />;
  return (
    <Carousel title={section.title} subtitle={section.subtitle}>
      {section.kind === 'tracks' && section.items.map((t, i) => <TrackCard key={t.id} track={t} tracks={section.items} index={i} />)}
      {section.kind === 'playlists' && section.items.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
      {section.kind === 'artists' && section.items.map((a) => <ArtistCard key={a.id} artist={a} />)}
    </Carousel>
  );
}

export function CarouselSkeleton() {
  return (
    <div className="mb-10">
      <Skeleton className="mb-4 h-7 w-48" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="w-40 shrink-0">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useHome();

  return (
    <div className="mx-auto max-w-[1478px] px-4 pt-4 sm:px-8 lg:px-12">
      <Chips options={MOODS} value={null} onChange={(mood) => navigate(`/explore/mood/${encodeURIComponent(mood)}`)} className="mb-8" />
      {isLoading && Array.from({ length: 3 }, (_, i) => <CarouselSkeleton key={i} />)}
      {isError && <Status icon="wifi_off" title="Couldn't load your home feed" action={<Button onClick={() => refetch()}>Retry</Button>} />}
      {data?.length === 0 && <Status icon="music_note" title="Start listening" message="Search for a song to build your library and recommendations." />}
      {data?.filter((s) => s.items.length > 0).map((section) => <SectionView key={section.id} section={section} />)}
    </div>
  );
}

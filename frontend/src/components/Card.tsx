import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TrackMenu } from './TrackMenu';
import { Icon, Thumb } from './ui';
import { artistNames } from '../lib/format';
import { loadPlaylistTracks, usePlayCollection } from '../lib/queries';
import type { Album, Artist, Playlist, Track } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';

interface CardProps {
  title: string;
  subtitle: ReactNode;
  images: (string | null)[];
  href?: string;
  circle?: boolean;
  onPlay?: () => void;
  menu?: ReactNode;
  icon?: string;
}

export function Card({ title, subtitle, images, href, circle, onPlay, menu, icon = 'music_note' }: CardProps) {
  const art =
    images.length >= 4 ? (
      <div className="grid h-full w-full grid-cols-2">
        {images.slice(0, 4).map((src, i) => (
          <Thumb key={i} src={src} rounded="" className="h-full w-full" icon={icon} />
        ))}
      </div>
    ) : (
      <Thumb src={images[0]} rounded="" className="h-full w-full" icon={icon} />
    );

  return (
    <div className="group w-[38vw] max-w-[200px] shrink-0 sm:w-44 lg:w-48">
      <div className={`relative aspect-square overflow-hidden ${circle ? 'rounded-full' : 'rounded-md'}`}>
        {href ? (
          <Link to={href} aria-label={title} className="block h-full w-full">
            {art}
          </Link>
        ) : (
          art
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 to-black/20 opacity-0 transition-opacity group-hover:opacity-100" />
        {menu && <div className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">{menu}</div>}
        {onPlay && (
          <button
            type="button"
            aria-label={`Play ${title}`}
            onClick={onPlay}
            className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/80 opacity-100 backdrop-blur-sm transition hover:scale-110 hover:bg-neutral-800 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Icon name="play_arrow" fill />
          </button>
        )}
      </div>
      <div className={`mt-2 ${circle ? 'text-center' : ''}`}>
        {href ? (
          <Link to={href} className="line-clamp-2 text-sm font-medium hover:underline">
            {title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm font-medium">{title}</p>
        )}
        <div className="line-clamp-2 text-sm text-muted">{subtitle}</div>
      </div>
    </div>
  );
}

export function TrackCard({ track, tracks, index }: { track: Track; tracks: Track[]; index: number }) {
  const dispatch = useAppDispatch();
  return (
    <Card
      title={track.title}
      subtitle={`Song • ${artistNames(track)}`}
      images={[track.thumbnailUrl]}
      href={track.album ? `/album/${track.album.id}` : undefined}
      onPlay={() => dispatch(playTracks({ tracks, startIndex: index }))}
      menu={<TrackMenu track={track} className="bg-black/50" />}
    />
  );
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const play = usePlayCollection();
  return (
    <Card
      onPlay={() => play(loadPlaylistTracks(playlist.id))}
      title={playlist.name}
      subtitle={`Playlist • ${playlist.owner?.username ?? 'OpenWav'} • ${playlist.trackCount} tracks`}
      images={playlist.coverUrls}
      href={`/playlist/${playlist.id}`}
      icon="queue_music"
    />
  );
}

export function AlbumCard({ album }: { album: Album }) {
  return (
    <Card
      title={album.name}
      subtitle={`Album${album.releaseYear ? ` • ${album.releaseYear}` : ''} • ${album.artists.map((a) => a.name).join(', ')}`}
      images={[album.coverUrl]}
      href={`/album/${album.id}`}
      icon="album"
    />
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return <Card title={artist.name} subtitle="Artist" images={[artist.imageUrl]} href={`/artist/${artist.id}`} circle icon="person" />;
}

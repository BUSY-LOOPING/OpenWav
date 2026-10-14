import type { ReactNode } from 'react';
import { Icon, Thumb } from './ui';

export function CollectionHeader({
  cover,
  title,
  meta,
  description,
  actions,
}: {
  cover: (string | null)[];
  title: ReactNode;
  meta: ReactNode;
  description?: string | null;
  actions: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-6 py-6 text-center md:flex-row md:items-end md:text-left lg:flex-col lg:items-center lg:text-center xl:sticky xl:top-0">
      <div className="aspect-square w-56 shrink-0 overflow-hidden rounded-lg shadow-2xl sm:w-64">
        {cover.length >= 4 ? (
          <div className="grid h-full grid-cols-2">
            {cover.slice(0, 4).map((src, i) => (
              <Thumb key={i} src={src} rounded="" className="h-full w-full" />
            ))}
          </div>
        ) : (
          <Thumb src={cover[0]} rounded="" className="h-full w-full" icon="queue_music" />
        )}
      </div>
      <div className="flex min-w-0 flex-col items-center gap-3 md:items-start lg:items-center">
        <h1 className="break-words text-2xl font-bold sm:text-3xl">{title}</h1>
        <div className="text-sm text-muted">{meta}</div>
        {description && <p className="line-clamp-3 max-w-xl text-sm text-muted">{description}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

export function PlayButtons({ onPlay, onShuffle, disabled }: { onPlay: () => void; onShuffle: () => void; disabled?: boolean }) {
  return (
    <>
      <button type="button" onClick={onShuffle} disabled={disabled} aria-label="Shuffle" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40">
        <Icon name="shuffle" />
      </button>
      <button type="button" onClick={onPlay} disabled={disabled} aria-label="Play" className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 disabled:opacity-40">
        <Icon name="play_arrow" fill size={36} />
      </button>
    </>
  );
}

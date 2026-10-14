import { useRef, type ReactNode } from 'react';
import { IconButton } from './ui';

export function Carousel({ title, subtitle, children, action }: { title: string; subtitle?: string | null; children: ReactNode; action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="mb-10" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {subtitle && <p className="text-sm uppercase tracking-wide text-muted">{subtitle}</p>}
          <h2 className="truncate text-xl font-bold sm:text-2xl">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <IconButton icon="chevron_left" label="Scroll left" onClick={() => scroll(-1)} className="hidden border border-white/20 sm:inline-flex" />
          <IconButton icon="chevron_right" label="Scroll right" onClick={() => scroll(1)} className="hidden border border-white/20 sm:inline-flex" />
        </div>
      </div>
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 sm:-mx-0 sm:gap-6 sm:px-0">
        {children}
      </div>
    </section>
  );
}

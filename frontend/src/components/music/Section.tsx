import { useRef, useState, useEffect, useCallback } from 'react';
import type { HomeSection, Tile } from '../../services/mediaService';
import { MusicCard } from './MusicCard';
import { Avatar } from '../ui/Avatar';
import { SkeletonCard } from '../skeleton';

const CARD_WIDTH_NORMAL = 160;
const CARD_WIDTH_LARGE  = 340;
const CARD_GAP          = 16;

interface SectionProps {
  section: HomeSection;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string | null;
  avatar?: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  );
}

function SectionHeader({
  title,
  subtitle,
  avatar,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-4 sm:mb-5">
      <div className="flex items-end gap-3 min-w-0 flex-1">
        {avatar && subtitle && <Avatar name={subtitle} size="lg" />}
        <div className="min-w-0">
          {subtitle && (
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-1 truncate">
              {subtitle}
            </p>
          )}
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-none truncate">
            {title}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button className="px-3 py-1 text-xs rounded-full border border-white/20 text-gray-400 hover:bg-white/5 transition-colors hidden sm:block">
          More
        </button>
        <button
          onClick={onScrollLeft}
          disabled={!canScrollLeft}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-default text-gray-400 hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={onScrollRight}
          disabled={!canScrollRight}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-default text-gray-400 hover:bg-white/5 hover:text-white"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

export function Section({ section }: SectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, section.tiles]);

  function scrollBy(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const step = (CARD_WIDTH_NORMAL + CARD_GAP) * 3;
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  }

  return (
    <section className="mb-10 sm:mb-12">
      <SectionHeader
        title={section.title}
        subtitle={section.subtitle}
        avatar={section.avatar}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onScrollLeft={() => scrollBy('left')}
        onScrollRight={() => scrollBy('right')}
      />

      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {section.tiles.map((tile) => (
          <MusicCard
            key={tile.id}
            tile={tile}
            queue={section.tiles}
            width={tile.size === 'large' ? CARD_WIDTH_LARGE : CARD_WIDTH_NORMAL}
          />
        ))}

        <div className="shrink-0 w-1" aria-hidden />
      </div>
    </section>
  );
}

export function SectionSkeleton() {
  return (
    <section className="mb-10 sm:mb-12">
      <div className="flex items-end justify-between mb-5">
        <div className="flex items-end gap-3">
          <div className="w-10 h-10 bg-white/[0.06] rounded-full animate-pulse" />
          <div className="space-y-2">
            <div className="h-2.5 w-16 bg-white/[0.04] rounded animate-pulse" />
            <div className="h-7 w-48 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0" style={{ width: i === 0 ? CARD_WIDTH_LARGE : CARD_WIDTH_NORMAL }}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </section>
  );
}
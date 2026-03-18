import { useState } from 'react';
import { useHomeSections } from '../../hooks/useMediaQueries';
import { Section, SectionSkeleton } from '../../components/music/Section';
import { Chip } from '../../components/ui/Chip';
import type { Tile } from '../../services/mediaService';

const CHIPS = ['Podcasts', 'Relax', 'Feel good', 'Sleep', 'Sad', 'Energise', 'Party', 'Commute', 'Romance'];

export default function Home() {
  const [activeChip, setActiveChip] = useState('Podcasts');
  const { data: sections, isLoading, isError } = useHomeSections();


  return (
    <div className="relative min-h-full">

      <div className="relative p-4 sm:p-6 lg:p-10 pt-4">
        <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 py-3 bg-[#030303]/95 flex gap-2 overflow-x-auto scrollbar-none mb-6 sm:mb-8">
          {CHIPS.map((chip) => (
            <Chip key={chip} label={chip} active={activeChip === chip} onClick={() => setActiveChip(chip)} />
          ))}
        </div>

        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-8 p-3 bg-red-400/5 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load content
          </div>
        )}

        {isLoading ? (
          <>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </>
        ) : (
          sections?.map((section) => (
            <Section key={section.type} section={section} />
          ))
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
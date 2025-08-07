import TrackCard from "./TrackCard";
import type { Track } from "../index";

interface SectionProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  showMoreButton?: boolean;
}

export default function Section({ title, subtitle, tracks, showMoreButton }: SectionProps) {
  return (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <div>
          {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
          <h2 className="text-3xl font-bold">{title}</h2>
        </div>
        <div className="flex items-center space-x-2">
          {showMoreButton && (
            <button className="text-gray-400 hover:text-white text-xs font-bold">MORE</button>
          )}
          <button className="bg-gray-800 p-1 rounded-full hover:bg-gray-700">
            <span className="material-icons">chevron_left</span>
          </button>
          <button className="bg-gray-800 p-1 rounded-full hover:bg-gray-700">
            <span className="material-icons">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {tracks.map((track) => (
          <TrackCard key={track.id} track={track} />
        ))}
      </div>
    </section>
  );
}

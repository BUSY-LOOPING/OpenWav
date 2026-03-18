import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { playTrack } from '../../store/slices/playerSlice';
import type { Tile } from '../../services/mediaService';
import { CARD_HEIGHT } from '../skeleton';

interface MusicCardProps {
  tile: Tile;
  queue?: Tile[];
  width?: number;
}

function MosaicThumbnail({ images }: { images: string[] }) {
  const filled = [...images, ...Array(4).fill('')].slice(0, 4);
  return (
    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
      {filled.map((src, i) =>
        src ? (
          <img key={i} src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <div key={i} className="w-full h-full bg-[#1a1a1a]" />
        )
      )}
    </div>
  );
}

export function MusicCard({ tile, queue = [], width }: MusicCardProps) {
  const dispatch = useDispatch<AppDispatch>();
  const isCircle = tile.tileType === 'circle';
  const isMosaic = tile.tileType === 'mosaic';

  function handlePlay() {
    dispatch(playTrack({
      track: {
        id: tile.id,
        title: tile.title,
        subtitle: tile.subtitle,
        thumbnail: tile.thumbnail,
      },
      queue: queue.map(t => ({
        id: t.id,
        title: t.title,
        subtitle: t.subtitle,
        thumbnail: t.thumbnail,
      })),
    }));
  }

  return (
    <div
      className="group cursor-pointer flex-shrink-0 flex flex-col"
      style={width ? { width } : undefined}
      onClick={handlePlay}
    >
      <div
        className={`relative w-full mb-3 overflow-hidden ${isCircle ? 'rounded-full' : 'rounded-md'}`}
        style={{ height: CARD_HEIGHT }}
      >
        {isMosaic && tile.images?.length ? (
          <MosaicThumbnail images={tile.images} />
        ) : tile.thumbnail ? (
          <img src={tile.thumbnail} alt={tile.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#2a2a2a' }}>
            <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)" className="w-8 h-8">
              <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h3V3h-6z" />
            </svg>
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="black" className="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {!!tile.resumePosition && tile.resumePosition > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="h-full bg-red-500" style={{ width: '40%' }} />
          </div>
        )}
      </div>

      <p className="text-sm font-semibold text-white truncate group-hover:underline leading-tight">
        {tile.title}
      </p>
      {tile.subtitle && (
        <p className="text-xs text-gray-500 truncate mt-0.5">{tile.subtitle}</p>
      )}
    </div>
  );
}
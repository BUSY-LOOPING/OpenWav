import { buildThumbnailUrl } from '../../utils/mediaConverter';

interface Track {
  thumbnailPath: string | null;
}

interface PlaylistCoverProps {
  tracks: Track[];
  name: string;
  size?: number;
}

export function PlaylistCover({ tracks, name, size = 220 }: PlaylistCoverProps) {
  const thumbs = tracks
    ?.map(t => buildThumbnailUrl(t.thumbnailPath))
    .filter((url): url is string => !!url)
    .slice(0, 4) ?? [];

  if (thumbs.length === 0) {
    return (
      <div
        className="rounded-lg flex items-center justify-center overflow-hidden bg-[#2a2a2a]"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" style={{ width: size * 0.4, height: size * 0.4 }}>
          <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h3V3h-6z" />
        </svg>
      </div>
    );
  }

  if (thumbs.length < 4) {
    return (
      <img
        src={thumbs[0]}
        alt={name}
        className="rounded-lg object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden grid grid-cols-2 shrink-0"
      style={{ width: size, height: size }}
    >
      {thumbs.map((url, i) => (
        <img key={i} src={url} alt="" className="w-full h-full object-cover" />
      ))}
    </div>
  );
}
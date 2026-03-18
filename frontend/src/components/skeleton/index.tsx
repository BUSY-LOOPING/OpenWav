import type { CSSProperties } from 'react';

export const CARD_HEIGHT = 160;

export function SkeletonBox({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`bg-[#282828] rounded animate-pulse ${className}`} style={style} />;
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBox className="w-full rounded-md" style={{ height: CARD_HEIGHT }} />
      <SkeletonBox className="h-4 w-3/4" />
      <SkeletonBox className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <SkeletonBox className="w-10 h-10 rounded shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <SkeletonBox className="h-3 w-2/3" />
        <SkeletonBox className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonSidebarPlaylist() {
  return (
    <div className="flex flex-col gap-1 px-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-2 flex flex-col gap-1.5">
          <SkeletonBox className="h-3 w-3/4" />
          <SkeletonBox className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
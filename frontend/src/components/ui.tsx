import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function Icon({ name, fill = false, className = '', size }: { name: string; fill?: boolean; className?: string; size?: number }) {
  return (
    <span aria-hidden="true" className={`icon ${fill ? 'icon-fill' : ''} ${className}`} style={size ? { fontSize: size } : undefined}>
      {name}
    </span>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  fill?: boolean;
  size?: number;
  active?: boolean;
}

export function IconButton({ icon, label, fill, size, active, className = '', ...props }: IconButtonProps) {
  const display = /(^|\s)hidden(\s|$)/.test(className) ? '' : 'inline-flex';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${display} shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10 disabled:opacity-40 ${active ? 'text-white' : ''} ${className}`}
      {...props}
    >
      <Icon name={icon} fill={fill} size={size} />
    </button>
  );
}

const ART = [
  ['#f2a7b5', '#7d6cf0'],
  ['#6fc3f7', '#4a4fd8'],
  ['#ffc46b', '#e8536a'],
  ['#62d6b0', '#1c8fb8'],
  ['#d68cf2', '#6a3cc9'],
];

const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Default artwork: a gradient tile with the icon on a white card, sized to the tile
export function DefaultArt({ icon = 'music_note', seed = '', rounded = 'rounded', className = '' }: { icon?: string; seed?: string; rounded?: string; className?: string }) {
  const [from, to] = ART[hashOf(seed || icon) % ART.length];
  return (
    <div className={`@container flex items-center justify-center ${rounded} ${className}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <span className="flex size-[58cqw] items-center justify-center rounded-[18%] bg-white/95 shadow-sm">
        <span aria-hidden="true" className="icon icon-fill text-[38cqw]" style={{ color: to }}>
          {icon}
        </span>
      </span>
    </div>
  );
}

export function Thumb({
  src,
  alt = '',
  className = '',
  rounded = 'rounded',
  icon = 'music_note',
  fallback,
  seed,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  rounded?: string;
  icon?: string;
  fallback?: string | null;
  seed?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [src, fallback].find((u): u is string => !!u && !failed.includes(u));
  if (!url) return <DefaultArt icon={icon} seed={seed ?? alt} rounded={rounded} className={className} />;
  return <img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed((f) => [...f, url])} className={`object-cover ${rounded} ${className}`} />;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
  className = '',
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  className?: string;
}) {
  return (
    <div role="tablist" className={`no-scrollbar flex gap-3 overflow-x-auto ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

export function Spinner({ className = '' }: { className?: string }) {
  return <div role="status" aria-label="Loading" className={`h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`} />;
}

export function Status({ icon, title, message, action }: { icon: string; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Icon name={icon} size={48} className="text-white/40" />
      <p className="text-lg font-medium">{title}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {action}
    </div>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-white text-black hover:bg-white/90',
    secondary: 'border border-white/20 text-white hover:bg-white/10',
    ghost: 'text-white hover:bg-white/10',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40';

interface Paged {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

export function LoadMore({ query }: { query: Paged }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), {
      root: el.parentElement?.closest('.overflow-y-auto') ?? null,
      rootMargin: '600px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  if (!hasNextPage) return null;
  return (
    <div ref={ref} className="col-span-full flex justify-center py-4">
      {isFetchingNextPage && <Spinner className="h-6 w-6" />}
    </div>
  );
}

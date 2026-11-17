import { useImageColor } from '../lib/color';

// Tints the top of the page with the artwork's colour, fading into the canvas like YouTube Music
export function Ambient({ src, fallback = 'hsl(210 30% 18%)' }: { src?: string | null; fallback?: string | null }) {
  const color = useImageColor(src) ?? fallback;
  if (!color) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-screen -translate-x-1/2 transition-[background] duration-700"
      style={{ background: `radial-gradient(120% 80% at 50% -10%, ${color} 0%, transparent 70%), linear-gradient(to bottom, ${color} 0%, transparent 100%)`, opacity: 0.85 }}
    />
  );
}

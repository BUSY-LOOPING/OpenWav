import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<string | null>>();

export function toAmbient([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  }
  // Keep the hue, but dim it so white text stays readable on top
  return `hsl(${Math.round(((h * 60) + 360) % 360)} ${Math.round(Math.min(s, 0.55) * 100)}% ${Math.round(Math.min(Math.max(l, 0.22), 0.32) * 100)}%)`;
}

// Average of the colourful pixels; near-black and near-white ones say little about the art
export function dominant(data: Uint8ClampedArray): [number, number, number] | null {
  let [r, g, b, total] = [0, 0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] < 128 || max < 24 || min > 232) continue;
    const weight = 1 + (max - min) / 32;
    r += data[i] * weight;
    g += data[i + 1] * weight;
    b += data[i + 2] * weight;
    total += weight;
  }
  return total ? [r / total, g / total, b / total] : null;
}

function extract(src: string) {
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 24;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0, 24, 24);
        const rgb = ctx ? dominant(ctx.getImageData(0, 0, 24, 24).data) : null;
        resolve(rgb ? toAmbient(rgb) : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function useImageColor(src: string | null | undefined) {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return setColor(null);
    let live = true;
    if (!cache.has(src)) cache.set(src, extract(src));
    cache.get(src)!.then((c) => live && setColor(c));
    return () => {
      live = false;
    };
  }, [src]);
  return color;
}

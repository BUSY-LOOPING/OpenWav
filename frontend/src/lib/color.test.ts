import { describe, expect, it } from 'vitest';
import { dominant, toAmbient } from './color';

const pixels = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

describe('ambient colour', () => {
  it('ignores black, white and transparent pixels and favours colourful ones', () => {
    expect(dominant(pixels([0, 0, 0, 255], [255, 255, 255, 255], [200, 40, 40, 0]))).toBeNull();
    const [r, g, b] = dominant(pixels([220, 60, 60, 255], [120, 120, 120, 255]))!;
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('keeps the hue but darkens it for legible text', () => {
    expect(toAmbient([255, 0, 0])).toBe('hsl(0 55% 32%)');
    expect(toAmbient([10, 10, 60])).toBe('hsl(240 55% 22%)');
  });
});

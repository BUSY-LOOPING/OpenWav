import { beforeAll, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k), clear: () => store.clear() });

let eq: typeof import('./equalizer');
beforeAll(async () => {
  eq = await import('./equalizer');
});

describe('equalizer', () => {
  it('leaves headroom equal to the largest boost', () => {
    expect(eq.preampDb(eq.PRESETS.Flat)).toBe(0);
    expect(eq.preampDb(eq.PRESETS['Bass boost'])).toBe(-6);
    expect(eq.preampDb([-3, -1])).toBe(0);
  });

  it('clamps gains and remembers the choice on this device', () => {
    eq.setEqualizer({ enabled: true, preset: 'Custom', gains: [20, -20, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(JSON.parse(store.get('ow.equalizer')!)).toMatchObject({ enabled: true, preset: 'Custom', gains: [12, -12, 0, 0, 0, 0, 0, 0, 0, 0] });
  });
});

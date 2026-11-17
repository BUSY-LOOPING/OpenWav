import { useSyncExternalStore } from 'react';

export const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const MAX_DB = 12;

export const PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  Vocal: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Rock: [4, 3, 1, -1, -1, 1, 3, 4, 4, 4],
  Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Electronic: [5, 4, 1, 0, -2, 1, 0, 2, 4, 5],
  Acoustic: [3, 3, 2, 1, 1, 1, 2, 3, 2, 1],
  'Late night': [-1, 0, 1, 2, 2, 1, 0, -1, -2, -3],
};

export interface EqState {
  enabled: boolean;
  preset: string;
  gains: number[];
}

const KEY = 'ow.equalizer';
const listeners = new Set<() => void>();

function load(): EqState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.gains) && saved.gains.length === BANDS.length) return saved;
  } catch {
    /* storage unavailable */
  }
  return { enabled: false, preset: 'Flat', gains: PRESETS.Flat };
}

let state = load();

export function setEqualizer(next: Partial<EqState>) {
  state = { ...state, ...next, gains: (next.gains ?? state.gains).map((g) => Math.max(-MAX_DB, Math.min(MAX_DB, g))) };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useEqualizer = () => useSyncExternalStore(subscribe, () => state);

// Headroom so boosted bands don't clip
export const preampDb = (gains: number[]) => -Math.max(0, ...gains) || 0;

// The element is routed through Web Audio only once the equaliser is first turned on,
// because createMediaElementSource can't be undone and some mobile browsers pause it in the background
export function attachEqualizer(audio: HTMLAudioElement) {
  let graph: { ctx: AudioContext; source: MediaElementAudioSourceNode; filters: BiquadFilterNode[]; preamp: GainNode } | null = null;

  function build() {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const filters = BANDS.map((frequency, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking';
      f.frequency.value = frequency;
      f.Q.value = 1.1;
      return f;
    });
    const preamp = ctx.createGain();
    filters.reduce<AudioNode>((prev, f) => (prev.connect(f), f), preamp);
    filters.at(-1)!.connect(ctx.destination);
    return { ctx, source, filters, preamp };
  }

  function apply() {
    if (!state.enabled && !graph) return;
    graph ??= build();
    const { ctx, source, filters, preamp } = graph;
    source.disconnect();
    if (state.enabled) {
      source.connect(preamp);
      preamp.gain.value = 10 ** (preampDb(state.gains) / 20);
      filters.forEach((f, i) => f.gain.setTargetAtTime(state.gains[i], ctx.currentTime, 0.02));
    } else {
      source.connect(ctx.destination);
    }
  }

  const resume = () => graph?.ctx.state === 'suspended' && graph.ctx.resume();
  audio.addEventListener('play', resume);
  apply();
  const unsubscribe = subscribe(apply);
  return () => {
    unsubscribe();
    audio.removeEventListener('play', resume);
    graph?.ctx.close();
  };
}

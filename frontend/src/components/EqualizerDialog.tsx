import { Dialog } from './Dialog';
import { Button, Chips } from './ui';
import { BANDS, MAX_DB, PRESETS, setEqualizer, useEqualizer } from '../lib/equalizer';

const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

export function EqualizerDialog({ onClose }: { onClose: () => void }) {
  const eq = useEqualizer();
  const presets = Object.keys(PRESETS);
  return (
    <Dialog title="Equaliser" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-5 pb-2">
        <label className="flex items-center justify-between text-sm">
          Equaliser
          <input type="checkbox" role="switch" aria-label="Equaliser on" checked={eq.enabled} onChange={(e) => setEqualizer({ enabled: e.target.checked })} className="h-5 w-9 accent-white" />
        </label>
        <Chips options={[...presets, ...(presets.includes(eq.preset) ? [] : [eq.preset])]} value={eq.preset} onChange={(preset) => PRESETS[preset] && setEqualizer({ enabled: true, preset, gains: PRESETS[preset] })} />
        <div className={`grid grid-cols-10 gap-1 ${eq.enabled ? '' : 'opacity-50'}`} role="group" aria-label="Bands">
          {BANDS.map((hz, i) => (
            <label key={hz} className="flex flex-col items-center gap-2 text-[10px] text-muted">
              <span className="tabular-nums text-white">{eq.gains[i] > 0 ? `+${eq.gains[i]}` : eq.gains[i]}</span>
              <input
                type="range"
                aria-label={`${label(hz)} hertz`}
                min={-MAX_DB}
                max={MAX_DB}
                step={1}
                value={eq.gains[i]}
                onChange={(e) => setEqualizer({ enabled: true, preset: 'Custom', gains: eq.gains.map((g, j) => (j === i ? Number(e.target.value) : g)) })}
                className="range h-32 w-1 [direction:rtl] [writing-mode:vertical-lr]"
                style={{ '--fill': `${((eq.gains[i] + MAX_DB) / (2 * MAX_DB)) * 100}%` } as React.CSSProperties}
              />
              {label(hz)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Saved on this device. On some phones the equaliser can pause music while the screen is locked; turn it off if that happens.</p>
      </div>
    </Dialog>
  );
}

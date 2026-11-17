import { useEffect, useRef, useState } from 'react';

export type Point = [number, number | null];

export interface Series {
  label: string;
  points: Point[];
  color?: string;
}

const SLOTS = ['var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)'];
const PAD = { top: 8, right: 12, bottom: 22, left: 48 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const timeLabel = (t: number, span: number) =>
  new Date(t * 1000).toLocaleString(undefined, span > 2 * 86_400 ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' });

export function LineChart({ title, series, format, max, height = 160 }: { title: string; series: Series[]; format: (v: number) => string; max?: number; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SLOTS[i % SLOTS.length] }));
  const xs = colored[0]?.points.map((p) => p[0]) ?? [];
  const values = colored.flatMap((s) => s.points.map((p) => p[1]).filter((v): v is number => v !== null));
  const empty = !xs.length || !values.length;
  const top = max ?? (Math.max(...values, 0) * 1.1 || 1);
  const [x0, x1] = [xs[0] ?? 0, xs.at(-1) ?? 1];
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - x0) / (x1 - x0 || 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (Math.min(v, top) / top) * innerH;
  const path = (points: Point[]) =>
    points.reduce((d, [t, v], i) => (v === null ? d : `${d}${i && points[i - 1][1] !== null ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`), '');

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = x0 + ((e.clientX - box.left - PAD.left) / innerW) * (x1 - x0);
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(v - t) < Math.abs(xs[best] - t)) best = i;
    });
    setHover(best);
  }

  const latest = colored.map((s) => [...s.points].reverse().find((p) => p[1] !== null)?.[1] ?? null);
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(xs[hover]) + 12, 0), width - 160);

  return (
    <figure className="rounded-xl bg-surface p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium">{title}</span>
        {colored.length === 1 && latest[0] !== null && <span className="text-sm tabular-nums text-muted">{format(latest[0])}</span>}
        {colored.length > 1 && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {colored.map((s, i) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: s.color }} />
                {s.label}
                {latest[i] !== null && <span className="tabular-nums text-white">{format(latest[i]!)}</span>}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative" style={{ height }}>
        {empty ? (
          <p className="flex h-full items-center justify-center text-sm text-muted">No data in this range</p>
        ) : (
          width > 0 && (
            <>
              <svg width={width} height={height} role="img" aria-label={`${title} over time`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y">
                {[0, 0.5, 1].map((f) => (
                  <g key={f}>
                    <line x1={PAD.left} x2={width - PAD.right} y1={y(top * f)} y2={y(top * f)} stroke="var(--color-line)" strokeWidth={1} />
                    <text x={PAD.left - 6} y={y(top * f)} dy="0.32em" textAnchor="end" className="fill-[var(--color-muted)] text-[10px] tabular-nums">
                      {format(top * f)}
                    </text>
                  </g>
                ))}
                {[x0, (x0 + x1) / 2, x1].map((t, i) => (
                  <text key={i} x={x(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-[var(--color-muted)] text-[10px]">
                    {timeLabel(t, x1 - x0)}
                  </text>
                ))}
                {colored.map((s) => (
                  <path key={s.label} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {hover !== null && (
                  <g>
                    <line x1={x(xs[hover])} x2={x(xs[hover])} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-muted)" strokeWidth={1} />
                    {colored.map((s) => {
                      const v = s.points[hover]?.[1];
                      return v === null || v === undefined ? null : <circle key={s.label} cx={x(xs[hover])} cy={y(v)} r={4} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />;
                    })}
                  </g>
                )}
              </svg>
              {hover !== null && (
                <div className="pointer-events-none absolute top-0 z-10 w-40 rounded-md border border-white/10 bg-raised px-3 py-2 text-xs shadow-xl" style={{ left: tipLeft }}>
                  <p className="mb-1 text-muted">{new Date(xs[hover] * 1000).toLocaleString()}</p>
                  {colored.map((s) => {
                    const v = s.points[hover]?.[1];
                    return (
                      <p key={s.label} className="flex items-center gap-2">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <strong className="tabular-nums">{v === null || v === undefined ? '—' : format(v)}</strong>
                        <span className="truncate text-muted">{s.label}</span>
                      </p>
                    );
                  })}
                </div>
              )}
            </>
          )
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Time</th>
            {colored.map((s) => (
              <th key={s.label}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {xs.map((t, i) => (
            <tr key={t}>
              <td>{new Date(t * 1000).toLocaleString()}</td>
              {colored.map((s) => (
                <td key={s.label}>{s.points[i]?.[1] === null || s.points[i]?.[1] === undefined ? '—' : format(s.points[i][1]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function RankList({ title, rows, format = String, empty = 'Nothing yet' }: { title: string; rows: { key: string; label: string; value: number; hint?: string }[]; format?: (v: number) => string; empty?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-xl bg-surface p-4" aria-label={title}>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {!rows.length ? (
        <p className="py-4 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">{format(r.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/5">
                <div className="h-full rounded-r bg-[var(--color-series-1)]" style={{ width: `${(r.value / top) * 100}%` }} />
              </div>
              {r.hint && <p className="mt-0.5 truncate text-xs text-muted">{r.hint}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

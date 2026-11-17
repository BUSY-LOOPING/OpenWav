import { useState } from 'react';
import { Chips, Status, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminHealth, useAdminTraces } from '../../lib/queries';
import { DataList } from './DataList';
import { SERVICES, WINDOWS, type Window } from './observability';

const explore = (grafana: string, traceId: string) =>
  `${grafana}/explore?orgId=1&schemaVersion=1&panes=${encodeURIComponent(JSON.stringify({ a: { datasource: 'tempo', queries: [{ refId: 'A', datasource: { type: 'tempo', uid: 'tempo' }, queryType: 'traceql', query: traceId }], range: { from: 'now-24h', to: 'now' } } }))}`;

export default function Traces() {
  const [service, setService] = useState('');
  const [minDurationMs, setMinDuration] = useState('');
  const [window, setWindow] = useState<Window>('1h');
  const [live, setLive] = useState(true);
  const params = { service: service || undefined, minDurationMs: Number(minDurationMs) || undefined, sinceSec: WINDOWS[window], limit: 100 };
  const { data = [], isLoading, isError, error } = useAdminTraces(params, live);
  const grafana = useAdminHealth().data?.links.find((l) => l.name === 'Grafana')?.url;
  const slowest = Math.max(1, ...data.map((t) => t.durationMs));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Traces</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select aria-label="Service" className="rounded bg-white/10 px-3 py-2 text-sm" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All services</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className={`${inputClass} sm:w-44`} type="number" min={0} inputMode="numeric" placeholder="Min duration (ms)" aria-label="Minimum duration in milliseconds" value={minDurationMs} onChange={(e) => setMinDuration(e.target.value)} />
        <Chips options={Object.keys(WINDOWS) as Window[]} value={window} onChange={setWindow} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" role="switch" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-white" /> Live
        </label>
      </div>
      {isError ? (
        <Status icon="timeline" title="Traces unavailable" message={errorMessage(error)} />
      ) : (
        <DataList
          items={data.map((t) => ({ ...t, id: t.traceId }))}
          loading={isLoading}
          empty="No traces in this window"
          columns={[
            { header: 'Started', cell: (t) => <span className="tabular-nums">{new Date(t.startedAt).toLocaleTimeString()}</span> },
            { header: 'Service', cell: (t) => t.service ?? '—' },
            { header: 'Operation', cell: (t) => <span className="block truncate font-mono text-xs">{t.name ?? '—'}</span> },
            {
              header: 'Duration',
              cell: (t) => (
                <div className="flex min-w-[140px] items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
                    <div className={`h-full ${t.durationMs > 1000 ? 'bg-red-400' : 'bg-sky-400'}`} style={{ width: `${(t.durationMs / slowest) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right tabular-nums">{t.durationMs} ms</span>
                </div>
              ),
            },
            {
              header: 'Trace',
              cell: (t) =>
                grafana ? (
                  <a href={explore(grafana, t.traceId)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-sky-300 hover:underline">
                    {t.traceId.slice(0, 12)}…
                  </a>
                ) : (
                  <span className="font-mono text-xs">{t.traceId.slice(0, 12)}…</span>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

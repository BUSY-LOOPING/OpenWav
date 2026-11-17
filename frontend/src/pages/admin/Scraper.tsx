import { useState } from 'react';
import { Button, Chips, Icon, Skeleton, Status, Thumb, inputClass } from '../../components/ui';
import { errorMessage, send } from '../../lib/api';
import { useAdminAction, useAdminScraper } from '../../lib/queries';
import { toast } from '../../lib/toast';
import type { ScraperRun } from '../../lib/types';

const ENDPOINTS = {
  search: [
    { name: 'q', label: 'Query', placeholder: 'blinding lights' },
    { name: 'filter', label: 'Filter', options: ['songs', 'videos', 'albums', 'artists', 'playlists'] },
    { name: 'limit', label: 'Limit', placeholder: '10' },
  ],
  suggestions: [{ name: 'q', label: 'Query', placeholder: 'tay' }],
  artist: [{ name: 'q', label: 'Artist name', placeholder: 'Taylor Swift' }],
  related: [{ name: 'videoId', label: 'Video id', placeholder: 'dQw4w9WgXcQ' }],
  playlist: [{ name: 'id', label: 'Playlist id', placeholder: 'PL…' }],
  charts: [{ name: 'country', label: 'Country code', placeholder: 'ZZ' }],
} as const;
type Endpoint = keyof typeof ENDPOINTS;

const SETTINGS = [
  { key: 'scraper.cache_ttl_sec', label: 'Cache time (seconds)', min: 0 },
  { key: 'scraper.timeout_sec', label: 'Upstream timeout (seconds)', min: 1 },
  { key: 'scraper.max_concurrency', label: 'Parallel upstream calls', min: 1 },
  { key: 'scraper.retries', label: 'Retries on 429 / 5xx', min: 0 },
];

interface Row {
  title?: string;
  name?: string;
  artists?: string[];
  channel?: string;
  thumbnailUrl?: string | null;
  type?: string;
}

function Results({ body }: { body: unknown }) {
  const data = body as { items?: unknown[]; item?: { tracks?: unknown[] } & Row };
  const rows = (data?.items ?? data?.item?.tracks ?? (data?.item ? [data.item] : [])) as (Row | string)[];
  if (!rows.length) return <p className="text-sm text-muted">No items in the response.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {rows.slice(0, 50).map((r, i) =>
        typeof r === 'string' ? (
          <li key={i} className="py-1.5 text-sm">
            {r}
          </li>
        ) : (
          <li key={i} className="flex items-center gap-3 py-1.5">
            <Thumb src={r.thumbnailUrl} seed={r.title ?? r.name} className="h-10 w-10 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{r.title ?? r.name}</span>
              <span className="block truncate text-xs text-muted">{[r.type, r.artists?.join(', ') ?? r.channel].filter(Boolean).join(' · ')}</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export default function Scraper() {
  const { data, isLoading, isError, error } = useAdminScraper();
  const settings = useAdminAction('scraper');
  const [endpoint, setEndpoint] = useState<Endpoint>('search');
  const [params, setParams] = useState<Record<string, string>>({ filter: 'songs' });
  const [fresh, setFresh] = useState(false);
  const [run, setRun] = useState<ScraperRun | null>(null);
  const [running, setRunning] = useState(false);
  const [raw, setRaw] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function execute() {
    setRunning(true);
    try {
      const fields = ENDPOINTS[endpoint].map((f) => f.name) as string[];
      setRun(await send<ScraperRun>('post', '/admin/scraper/run', { endpoint, params: Object.fromEntries(Object.entries(params).filter(([k, v]) => fields.includes(k) && v.trim())), fresh }));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  const changed = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
  const cache = data?.stats?.cache;
  const hitRate = cache && cache.hits + cache.misses ? cache.hits / (cache.hits + cache.misses) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Scraper</h1>
      {isLoading ? (
        <Skeleton className="mb-6 h-32 w-full" />
      ) : isError || !data ? (
        <Status icon="travel_explore" title="Scraper status unavailable" message={errorMessage(error)} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Status</p>
              <p className={`mt-2 flex items-center gap-2 text-2xl font-bold ${data.health === 'up' ? '' : 'text-red-400'}`}>
                <Icon name={data.health === 'up' ? 'check_circle' : 'error'} className={data.health === 'up' ? 'text-emerald-300' : ''} /> {data.health}
              </p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Cache hit rate</p>
              <p className="mt-2 text-2xl font-bold">{hitRate === null ? '—' : `${Math.round(hitRate * 100)}%`}</p>
              <p className="mt-1 text-xs text-muted">{cache ? `${cache.entries} in memory · ${cache.hits} hits · ${cache.misses} misses` : 'since last restart'}</p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Upstream errors, 24 h</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{data.upstreamErrors.reduce((n, e) => n + e.count, 0)}</p>
              <p className="mt-1 text-xs text-muted">{data.upstreamErrors.map((e) => `${e.source} ${e.count}`).join(' · ') || 'none'}</p>
            </div>
            <div className="flex flex-col justify-between gap-2 rounded-xl bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Cache</p>
              <Button
                variant="secondary"
                onClick={() => settings.mutate({ method: 'delete', url: '/admin/scraper/cache' }, { onSuccess: (r) => toast(`Cleared ${(r as { cleared: number }).cleared} cached results`), onError: (e) => toast(errorMessage(e)) })}
              >
                <Icon name="delete_sweep" /> Clear cache
              </Button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-xl bg-surface p-4" aria-label="Settings">
              <h2 className="mb-1 text-lg font-bold">Settings</h2>
              <p className="mb-4 text-sm text-muted">Applied by the scraper within 15 seconds, no restart needed.</p>
              <div className="grid grid-cols-2 gap-3">
                {SETTINGS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs text-muted">
                    {f.label}
                    <input className={inputClass} type="number" min={f.min} inputMode="numeric" placeholder={String(data.settings[f.key] ?? '')} value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                  </label>
                ))}
              </div>
              <Button
                className="mt-4"
                disabled={!Object.keys(changed).length || settings.isPending}
                onClick={() =>
                  settings.mutate(
                    { method: 'patch', url: '/admin/settings', body: changed },
                    {
                      onSuccess: () => {
                        toast('Scraper settings saved');
                        setDraft({});
                      },
                      onError: (e) => toast(errorMessage(e)),
                    },
                  )
                }
              >
                Save
              </Button>
              {data.stats && (
                <p className="mt-3 text-xs text-muted">
                  Running with cache {data.stats.config.cacheTtlSec}s · timeout {data.stats.config.timeoutSec}s · {data.stats.config.maxConcurrency} parallel · {data.stats.config.retries} retries
                </p>
              )}
            </section>
            <section className="rounded-xl bg-surface p-4" aria-label="Endpoints">
              <h2 className="mb-3 text-lg font-bold">Endpoints, last 15 min</h2>
              {!data.routes.length ? (
                <p className="text-sm text-muted">No traffic recorded.</p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {data.routes.map((r) => (
                    <li key={r.route} className="flex justify-between gap-3 py-1.5">
                      <span className="font-mono text-xs">{r.route}</span>
                      <span className="tabular-nums text-muted">
                        {(r.rps * 60).toFixed(1)}/min · p95 {r.p95Ms ?? '—'} ms
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <section className="rounded-xl bg-surface p-4" aria-label="Try the scraper">
        <h2 className="mb-1 text-lg font-bold">Try it</h2>
        <p className="mb-4 text-sm text-muted">Call any scraper endpoint with your own parameters and see exactly what it returns.</p>
        <Chips options={Object.keys(ENDPOINTS) as Endpoint[]} value={endpoint} onChange={(e) => (setEndpoint(e), setRun(null))} className="mb-4" />
        <form
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            execute();
          }}
        >
          {ENDPOINTS[endpoint].map((f) => (
            <label key={f.name} className="flex flex-col gap-1 text-xs text-muted sm:w-48">
              {f.label}
              {'options' in f ? (
                <select className={inputClass} value={params[f.name] ?? f.options[0]} onChange={(e) => setParams((p) => ({ ...p, [f.name]: e.target.value }))}>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input className={inputClass} placeholder={f.placeholder} value={params[f.name] ?? ''} onChange={(e) => setParams((p) => ({ ...p, [f.name]: e.target.value }))} />
              )}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm sm:pb-2">
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="accent-white" /> Skip cache
          </label>
          <Button type="submit" disabled={running}>
            <Icon name="play_arrow" fill /> {running ? 'Running…' : 'Run'}
          </Button>
        </form>
        {run && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className={run.status < 400 ? 'text-emerald-300' : 'text-red-300'}>
                HTTP {run.status} · {run.durationMs} ms
              </span>
              <label className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} className="accent-white" /> Raw JSON
              </label>
            </div>
            {raw ? <pre className="thin-scrollbar max-h-[480px] overflow-auto rounded-lg bg-black/40 p-3 font-mono text-xs">{JSON.stringify(run.body, null, 2)}</pre> : <Results body={run.body} />}
          </div>
        )}
      </section>
    </div>
  );
}

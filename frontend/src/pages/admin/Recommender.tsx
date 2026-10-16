import { Link } from 'react-router-dom';
import { Button, Icon, Skeleton, Status } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminAction, useAdminRecommender } from '../../lib/queries';
import { toast } from '../../lib/toast';
import type { RecommenderParams } from '../../lib/types';

const EVENT_BY_WEIGHT: Record<number, string> = { 5: 'Like', 4: 'Add to playlist', 3: 'Play complete', 1: 'Play start', [-1]: 'Early skip', [-5]: 'Unlike' };

const PARAM_LABELS: [keyof RecommenderParams, string][] = [
  ['factors', 'Factors'],
  ['iterations', 'Iterations'],
  ['reg', 'Regularization'],
  ['alpha', 'Alpha'],
  ['content_weight', 'Content weight'],
  ['half_life_days', 'Half-life (days)'],
  ['window_days', 'Window (days)'],
];

const num = (n: number | undefined) => (n === undefined ? '-' : n.toLocaleString(undefined, { maximumFractionDigits: 4 }));

function LossChart({ loss }: { loss: number[] }) {
  if (loss.length < 2) return <p className="text-sm text-muted">The loss curve appears once training runs at least two iterations.</p>;
  const w = 600;
  const h = 180;
  const pad = 8;
  const low = Math.min(...loss);
  const high = Math.max(...loss);
  const x = (i: number) => pad + (i / (loss.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (high > low ? (1 - (v - low) / (high - low)) : 0.5) * (h - pad * 2);
  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-right text-xs tabular-nums text-muted">
          <span>{num(high)}</span>
          <span>{num(low)}</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full text-sky-300" role="img" aria-label={`Training loss over ${loss.length} iterations, from ${num(loss[0])} to ${num(loss.at(-1))}`}>
          <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="stroke-white/10" />
          <polyline fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" points={loss.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          {loss.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={4} fill="currentColor" className="stroke-surface" strokeWidth={2} />
              <circle cx={x(i)} cy={y(v)} r={12} fill="transparent">
                <title>{`Iteration ${i + 1}: loss ${num(v)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-1 text-center text-xs text-muted">Iteration 1 to {loss.length}</figcaption>
    </figure>
  );
}

export default function Recommender() {
  const { data, isLoading, isError, error, refetch } = useAdminRecommender();
  const action = useAdminAction('recommender');

  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-6xl" />;
  if (isError || !data) return <Status icon="cloud_off" title="Couldn't load the recommender" message={error ? errorMessage(error) : undefined} action={<Button onClick={() => refetch()}>Retry</Button>} />;

  const { status, model, params, runs, data: overview } = data;
  const busy = status.state === 'loading' || status.state === 'training';
  const latest = runs[0];
  const loss = busy ? (status.loss ?? []) : (latest?.loss ?? []);
  const shownParams = busy ? (status.params ?? params) : (latest?.params ?? params);
  const pendingChange = !busy && !!latest?.params && PARAM_LABELS.some(([k]) => latest.params![k] !== params[k]);
  const dailyMax = Math.max(1, ...overview.daily.map((d) => d.count));
  const weightMax = Math.max(1, ...overview.weights.map((w) => w.count));

  const train = () =>
    action.mutate({ method: 'post', url: '/admin/recommender/retrain' }, { onSuccess: () => toast('Training started'), onError: (e) => toast(errorMessage(e)) });

  const tiles = [
    ['Model version', model.version ? new Date(model.trainedAt!).toLocaleString() : 'Untrained'],
    ['Users', num(model.users)],
    ['Tracks', num(model.items)],
    ['Interactions', num(overview.totals.interactions)],
    ['Positive', num(overview.totals.positive)],
    ['Matrix density', latest?.density !== undefined ? `${(latest.density * 100).toFixed(2)}%` : '-'],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recommender</h1>
          <p className="text-sm text-muted">
            Implicit ALS on listening events, blended with tag and artist similarity.{' '}
            <Link to="/admin/settings#recommender" className="text-white underline">
              Tune parameters
            </Link>
          </p>
        </div>
        <Button onClick={train} disabled={busy || action.isPending}>
          <Icon name={busy ? 'progress_activity' : 'model_training'} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Training' : 'Train now'}
        </Button>
      </div>

      {status.state === 'failed' && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">Last training failed: {status.error}</p>}
      {pendingChange && <p className="mb-4 rounded-lg bg-surface p-3 text-sm text-muted">Parameters changed since the last run. Train now to apply them.</p>}
      {busy && (
        <div className="mb-6 rounded-xl bg-surface p-4">
          <p className="mb-2 text-sm">
            {status.state === 'loading' ? 'Loading interactions and catalog' : `Iteration ${status.iteration ?? 0} of ${shownParams.iterations}`}
            {status.startedAt && <span className="text-muted"> · started {new Date(status.startedAt).toLocaleTimeString()}</span>}
          </p>
          <div className="h-1 overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={status.iteration ?? 0} aria-valuemin={0} aria-valuemax={shownParams.iterations}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${((status.iteration ?? 0) / shownParams.iterations) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-2 truncate text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section aria-label="Training loss" className="rounded-xl bg-surface p-4 lg:col-span-2">
          <h2 className="mb-1 text-lg font-bold">Training loss</h2>
          <p className="mb-4 text-xs text-muted">Weighted squared error plus regularization per cell, {busy ? 'live' : 'last run'}</p>
          <LossChart loss={loss} />
        </section>
        <section aria-label="Parameters" className="rounded-xl bg-surface p-4">
          <h2 className="mb-4 text-lg font-bold">{busy ? 'Training with' : 'Last run used'}</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {PARAM_LABELS.map(([key, label]) => (
              <div key={key} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right tabular-nums">
                  {num(shownParams[key])}
                  {pendingChange && latest?.params?.[key] !== params[key] && <span className="text-sky-300"> → {num(params[key])}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section aria-label="Daily interactions" className="rounded-xl bg-surface p-4 lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">Interactions, last 30 days</h2>
          {!overview.daily.length ? (
            <p className="text-sm text-muted">No interactions recorded in the last 30 days.</p>
          ) : (
            <>
              <div className="flex h-36 items-end gap-0.5" role="img" aria-label={`Daily interactions, peak ${dailyMax}`}>
                {overview.daily.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.count}`} className="flex h-full flex-1 items-end hover:bg-white/5">
                    <div className="w-full rounded-t bg-sky-300" style={{ height: `${(d.count / dailyMax) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{overview.daily[0].day}</span>
                <span>peak {dailyMax}</span>
                <span>{overview.daily.at(-1)!.day}</span>
              </div>
            </>
          )}
        </section>
        <section aria-label="Event mix" className="rounded-xl bg-surface p-4">
          <h2 className="mb-4 text-lg font-bold">Event mix</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {overview.weights.map((w) => (
              <li key={w.weight}>
                <div className="mb-1 flex justify-between">
                  <span>
                    {EVENT_BY_WEIGHT[w.weight] ?? 'Other'} <span className="text-xs text-muted">weight {w.weight}</span>
                  </span>
                  <span className="tabular-nums text-muted">{num(w.count)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded bg-white/10">
                  <div className={`h-full ${w.weight > 0 ? 'bg-sky-300' : 'bg-white/40'}`} style={{ width: `${(w.count / weightMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Top tracks">
          <h2 className="mb-3 text-lg font-bold">Strongest signal tracks</h2>
          <ol className="flex flex-col gap-1">
            {overview.topItems.map((t, i) => (
              <li key={t.mediaId} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t.title ?? <span className="text-muted">Deleted track</span>}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {num(t.score)} from {t.interactions}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-label="Recent interactions">
          <h2 className="mb-3 text-lg font-bold">Latest interactions</h2>
          <ul className="flex flex-col gap-1">
            {overview.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted">{r.user ?? 'unknown'}</span> · {r.title ?? 'Deleted track'}
                </span>
                <span className={`shrink-0 text-xs ${r.weight > 0 ? 'text-sky-300' : 'text-muted'}`}>{EVENT_BY_WEIGHT[r.weight] ?? r.weight}</span>
                <span className="hidden shrink-0 text-xs text-muted sm:inline">{new Date(r.occurredAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Training runs">
        <h2 className="mb-3 text-lg font-bold">Training runs</h2>
        {!runs.length ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <div className="thin-scrollbar overflow-x-auto rounded-xl bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  {['Trained', 'Users', 'Tracks', 'Interactions', 'Factors × iters', 'Final loss', 'Duration'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {runs.map((r) => (
                  <tr key={r.version} className="border-t border-white/5">
                    <td className="px-3 py-2">{new Date(r.trainedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{num(r.users)}</td>
                    <td className="px-3 py-2">{num(r.items)}</td>
                    <td className="px-3 py-2">{num(r.interactions)}</td>
                    <td className="px-3 py-2">{r.params ? `${r.params.factors} × ${r.params.iterations}` : '-'}</td>
                    <td className="px-3 py-2">{num(r.loss?.at(-1))}</td>
                    <td className="px-3 py-2">{r.seconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

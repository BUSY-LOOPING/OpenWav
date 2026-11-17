import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Button, Icon, Skeleton, Status } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminAction, useAdminDeadLetters, useAdminQueues, useAdminYtdlp } from '../../lib/queries';
import { toast } from '../../lib/toast';

const QUEUE_LABEL: Record<string, string> = { downloads: 'Downloads', playlists: 'Playlist imports', 'downloads.retry': 'Waiting to retry', 'downloads.dead': 'Dead letters' };

function YtdlpCard() {
  const { data, isLoading } = useAdminYtdlp();
  const action = useAdminAction('ytdlp');
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const status = data?.status;
  const outdated = !!status?.version && !!status.latest && status.version.replace(/\.0+(\d)/g, '.$1') !== status.latest.replace(/\.0+(\d)/g, '.$1');
  const rate = data?.last24h.successRate;
  const unhealthy = rate !== null && rate !== undefined && rate < 0.8;
  return (
    <section className="rounded-xl bg-surface p-4" aria-label="yt-dlp">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">yt-dlp</h2>
          <p className="text-sm text-muted">
            {status?.version ? `Installed ${status.version}` : 'Version not reported yet'}
            {status?.latest && ` · latest ${status.latest}`}
          </p>
        </div>
        <Button
          variant={outdated ? 'primary' : 'secondary'}
          disabled={status?.updating || action.isPending}
          onClick={() => action.mutate({ method: 'post', url: '/admin/ytdlp/update' }, { onSuccess: () => toast('Update started'), onError: (e) => toast(errorMessage(e)) })}
        >
          <Icon name="system_update_alt" /> {status?.updating ? 'Updating…' : outdated ? 'Update now' : 'Reinstall latest'}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Success, last 24 h</p>
          <p className={`flex items-center gap-1 text-xl font-bold ${unhealthy ? 'text-red-400' : ''}`}>
            {unhealthy && <Icon name="warning" size={18} />}
            {rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Completed · failed</p>
          <p className="text-xl font-bold tabular-nums">
            {data?.last24h.completed ?? 0} · {data?.last24h.failed ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Last success</p>
          <p className="text-sm">{data?.lastSuccessAt ? new Date(data.lastSuccessAt).toLocaleString() : 'never'}</p>
        </div>
      </div>
      {status?.lastUpdate && (
        <p className={`mt-3 text-xs ${status.lastUpdate.ok ? 'text-muted' : 'text-red-300'}`}>
          Last update {new Date(status.lastUpdate.at).toLocaleString()}: {status.lastUpdate.ok ? 'succeeded' : 'failed'} · <span className="font-mono">{status.lastUpdate.output}</span>
        </p>
      )}
      {!!data?.topErrors.length && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-muted">Most common errors</p>
          <ul className="flex flex-col gap-1 text-xs">
            {data.topErrors.map((e) => (
              <li key={e.message} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-muted">{e.count}×</span>
                <span className="min-w-0 truncate font-mono" title={e.message}>
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Updates apply to the running downloader right away and last until its next rebuild, which installs the newest release.</p>
    </section>
  );
}

export default function Jobs() {
  const { data, isLoading, isError, error } = useAdminQueues();
  const action = useAdminAction('queues');
  const [showDead, setShowDead] = useState(false);
  const [purge, setPurge] = useState(false);
  const dead = useAdminDeadLetters(showDead);
  const deadCount = data?.queues.find((q) => q.name === 'downloads.dead')?.messages ?? 0;
  const run = (method: 'post' | 'put' | 'delete', url: string, body: unknown, done: (r: unknown) => string) =>
    action.mutate({ method, url, body }, { onSuccess: (r) => (toast(done(r)), dead.refetch()), onError: (e) => toast(errorMessage(e)) });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Jobs &amp; queues</h1>
      {isLoading ? (
        <Skeleton className="mb-6 h-32 w-full" />
      ) : isError || !data ? (
        <div className="mb-6">
          <Status icon="queue" title="Queues unavailable" message={errorMessage(error)} />
        </div>
      ) : (
        <>
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${data.paused ? 'bg-yellow-500/10' : 'bg-surface'}`}>
            <p className="flex items-center gap-2 text-sm">
              <Icon name={data.paused ? 'pause_circle' : 'play_circle'} className={data.paused ? 'text-yellow-300' : 'text-emerald-300'} />
              {data.paused ? 'Downloads are paused. Running downloads finish, nothing new starts.' : 'Downloads are running.'}
            </p>
            <Button variant={data.paused ? 'primary' : 'secondary'} onClick={() => run('put', '/admin/queues/paused', { paused: !data.paused }, () => (data.paused ? 'Downloads resumed' : 'Downloads paused'))}>
              <Icon name={data.paused ? 'play_arrow' : 'pause'} /> {data.paused ? 'Resume' : 'Pause all downloads'}
            </Button>
          </div>
          <ul className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.queues.map((q) => (
              <li key={q.name} className="rounded-xl bg-surface p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{QUEUE_LABEL[q.name] ?? q.name}</p>
                <p className={`mt-2 text-2xl font-bold tabular-nums ${q.name === 'downloads.dead' && q.messages ? 'text-red-400' : ''}`}>{q.messages}</p>
                <p className="mt-1 text-xs text-muted">{q.consumers} consumers</p>
              </li>
            ))}
          </ul>
          <section className="mb-6 rounded-xl bg-surface p-4" aria-label="Dead letters">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Dead letters</h2>
                <p className="text-sm text-muted">Jobs that crashed twice or could not be read. Replaying resets their retries.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowDead((v) => !v)} disabled={!deadCount}>
                  {showDead ? 'Hide' : 'Inspect'}
                </Button>
                <Button onClick={() => run('post', '/admin/queues/dead/replay', undefined, (r) => `Replayed ${(r as { replayed: number }).replayed} jobs`)} disabled={!deadCount}>
                  Replay all
                </Button>
                <Button variant="danger" onClick={() => setPurge(true)} disabled={!deadCount}>
                  Purge
                </Button>
              </div>
            </div>
            {showDead && (
              <ul className="mt-3 divide-y divide-white/5 text-sm">
                {(dead.data ?? []).map((d) => (
                  <li key={d.id} className="py-2">
                    <p className="truncate font-medium">{d.title ?? d.url ?? 'Unreadable message'}</p>
                    <p className="truncate text-xs text-muted">
                      {QUEUE_LABEL[d.queue ?? ''] ?? d.queue} · {d.reason} · died {d.deaths}×{d.error ? ` · ${d.error}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mb-6 rounded-xl bg-surface p-4" aria-label="Scheduled jobs">
            <h2 className="mb-3 text-lg font-bold">Scheduled jobs, last 24 h</h2>
            {!data.scheduler.length ? (
              <p className="text-sm text-muted">No runs recorded yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {data.scheduler.map((j) => (
                  <li key={j.job} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="font-mono text-xs">{j.job}</span>
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      <Icon name={j.error ? 'error' : 'check_circle'} size={16} className={j.error ? 'text-red-400' : 'text-emerald-300'} />
                      {j.ok} ok{j.error ? ` · ${j.error} failed` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <YtdlpCard />
      {purge && (
        <Dialog
          title="Purge dead letters?"
          onClose={() => setPurge(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPurge(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => (setPurge(false), run('delete', '/admin/queues/dead', undefined, (r) => `Purged ${(r as { purged: number }).purged} jobs`))}>
                Purge
              </Button>
            </>
          }
        >
          <p className="pb-2 text-sm text-muted">{deadCount} dead jobs will be discarded. Their download tasks stay marked as failed.</p>
        </Dialog>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Button, Icon, Skeleton, Status } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminAction, useAdminDiscovery } from '../../lib/queries';
import { toast } from '../../lib/toast';
import type { TaskStatus } from '../../lib/types';

const STATUS_TONE: Record<TaskStatus, string> = {
  queued: 'text-muted',
  downloading: 'text-sky-300',
  uploading: 'text-sky-300',
  completed: 'text-emerald-300',
  failed: 'text-red-400',
  cancelled: 'text-muted',
};

const SOURCE_ICON = { charts: 'trending_up', genre: 'category', artist: 'person', picks: 'auto_awesome', playlist: 'queue_music' } as const;

export default function Discovery() {
  const { data, isLoading, isError, refetch } = useAdminDiscovery();
  const action = useAdminAction('discovery');
  const run = data?.lastRun;
  const pending = !!data?.requestedAt && (!run || data.requestedAt > run.startedAt);
  const running = !!run && !run.finishedAt;
  const nextAt = run && data?.settings['discovery.enabled'] ? new Date(Date.parse(run.startedAt) + Number(data.settings['discovery.interval_hours']) * 3_600_000) : null;

  const runNow = () =>
    action.mutate({ method: 'post', url: '/admin/discovery/run' }, { onSuccess: () => toast('Run requested, the scheduler picks it up within a minute'), onError: (e) => toast(errorMessage(e)) });

  if (isLoading) return <Skeleton className="mx-auto h-64 max-w-6xl" />;
  if (isError || !data) return <Status icon="cloud_off" title="Couldn't load auto-discovery" action={<Button onClick={() => refetch()}>Retry</Button>} />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auto-discovery</h1>
          <p className="text-sm text-muted">
            Downloads top tracks from charts, genres, your top artists, picks and playlists.{' '}
            <Link to="/admin/settings#discovery" className="text-white underline">
              Configure
            </Link>
          </p>
        </div>
        <Button onClick={runNow} disabled={pending || running || action.isPending}>
          <Icon name={running ? 'progress_activity' : 'play_arrow'} className={running ? 'animate-spin' : ''} />
          {running ? 'Running' : pending ? 'Queued' : 'Run now'}
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(['queued', 'downloading', 'uploading', 'completed', 'failed', 'cancelled'] as const).map((s) => (
          <div key={s} className="rounded-xl bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{s}</p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${STATUS_TONE[s]}`}>{data.counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {!run ? (
        <Status icon="travel_explore" title="No runs yet" message={data.settings['discovery.enabled'] ? 'The first run starts within a minute.' : 'Auto-discovery is disabled.'} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Last run {new Date(run.startedAt).toLocaleString()} ({run.trigger})
            {run.finishedAt ? ` · finished ${new Date(run.finishedAt).toLocaleTimeString()}` : ' · in progress'}
            {nextAt && ` · next ${nextAt.toLocaleString()}`}
          </p>
          {run.error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{run.error}</p>}

          <h2 className="mb-3 text-lg font-bold">Sources</h2>
          <ul className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {run.sources.map((src) => (
              <li key={`${src.source}-${src.label}`} className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm">
                <Icon name={SOURCE_ICON[src.source]} className="text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium capitalize">{src.label}</p>
                  <p className={`text-xs ${src.error ? 'text-red-400' : 'text-muted'}`}>{src.error ?? `${src.found} found · ${src.queued} queued · ${src.skipped} already have`}</p>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 text-lg font-bold">Downloads from this run</h2>
          {!data.tasks.length ? (
            <p className="text-sm text-muted">Nothing new to download, everything found is already in the library.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.tasks.map((t) => (
                <li key={t.id} className="rounded-lg bg-surface px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate">{t.title ?? t.url}</span>
                    <span className={`shrink-0 text-xs capitalize ${STATUS_TONE[t.status]}`}>{t.status}</span>
                  </div>
                  {(t.status === 'downloading' || t.status === 'uploading') && (
                    <div className="mt-2 h-1 overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${t.progress}%` }} />
                    </div>
                  )}
                  {t.status === 'failed' && t.errorMessage && <p className="mt-1 truncate text-xs text-red-400">{t.errorMessage}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

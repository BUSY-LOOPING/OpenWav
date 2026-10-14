import { Icon, Skeleton, Status } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { useAdminAlerts, useAdminHealth, useAdminStats } from '../../lib/queries';

function Stat({ label, value, hint, tone = '' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v)} ms`);

export default function Dashboard() {
  const stats = useAdminStats();
  const health = useAdminHealth();
  const alerts = useAdminAlerts();
  const s = stats.data ?? {};
  const http = health.data?.http;
  const num = (group: string, key: string) => Number(s[group]?.[key] ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <section aria-label="Alerts" className="mb-6">
        {alerts.data?.length ? (
          <ul className="flex flex-col gap-2">
            {alerts.data.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
                <Icon name="warning" className="text-red-400" />
                <div className="min-w-0">
                  <p className="font-medium">{a.labels.alertname}</p>
                  <p className="text-muted">{a.annotations.summary ?? a.annotations.description}</p>
                  <p className="text-xs text-muted">since {new Date(a.startsAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <Icon name="check_circle" /> No active alerts
          </p>
        )}
      </section>

      <h2 className="mb-3 text-lg font-bold">Latency</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="HTTP P95" value={ms(http?.p95Ms)} tone={(http?.p95Ms ?? 0) > Number(s.alerts?.p95_ms ?? 500) ? 'text-red-400' : ''} />
        <Stat label="HTTP P99" value={ms(http?.p99Ms)} tone={(http?.p99Ms ?? 0) > Number(s.alerts?.p99_ms ?? 1500) ? 'text-red-400' : ''} />
        <Stat label="Error rate" value={http?.errorRate === null || http?.errorRate === undefined ? '—' : `${(http.errorRate * 100).toFixed(2)}%`} />
      </div>

      <h2 className="mb-3 text-lg font-bold">Services</h2>
      {health.isLoading ? (
        <Skeleton className="mb-8 h-24 w-full" />
      ) : health.isError ? (
        <Status icon="cloud_off" title="Health check failed" />
      ) : (
        <ul className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {health.data?.services.map((svc) => (
            <li key={svc.name} className="rounded-xl bg-surface p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={`h-2.5 w-2.5 rounded-full ${svc.status === 'up' ? 'bg-emerald-400' : 'bg-red-500'}`} aria-hidden />
                {svc.name}
              </p>
              <p className="mt-1 text-xs text-muted">
                {svc.status} · {ms(svc.latencyMs)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 text-lg font-bold">Monitoring tools</h2>
      <ul className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.data?.links.map((link) => (
          <li key={link.name} className="flex items-start gap-3 rounded-xl bg-surface p-4">
            <Icon name="open_in_new" className="text-muted" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                  {link.name}
                </a>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${link.status === 'up' ? 'bg-emerald-500/15 text-emerald-300' : link.status === 'down' ? 'bg-red-500/15 text-red-300' : 'bg-white/10 text-muted'}`}>
                  {link.status === 'manual' ? 'local' : link.status}
                </span>
              </p>
              <p className="text-xs text-muted">{link.description}</p>
              {link.dashboardUrl && (
                <a href={link.dashboardUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-300 hover:underline">
                  OpenWav overview dashboard
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-lg font-bold">Usage</h2>
      {stats.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Users" value={String(num('users', 'total'))} hint={`${num('users', 'activeToday')} active today · ${num('users', 'newThisWeek')} new this week`} />
          <Stat label="Tracks" value={String(num('media', 'total'))} hint={`${num('media', 'newThisWeek')} added this week`} />
          <Stat label="Downloads" value={String(num('downloads', 'total'))} hint={`${num('downloads', 'queued')} queued · ${num('downloads', 'failed')} failed`} />
          <Stat label="Storage" value={formatBytes(num('storage', 'totalBytes'))} hint={`${num('events', 'last24h')} events in 24 h`} />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Button, Skeleton, Status, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/format';
import { useAdminAction, useAdminStorage } from '../../lib/queries';
import { toast } from '../../lib/toast';
import type { Disk } from '../../lib/types';

function Tier({ title, disk, holds, empty }: { title: string; disk: Disk | null; holds: string; empty: string }) {
  const used = disk && disk.availBytes !== null ? (disk.sizeBytes - disk.availBytes) / disk.sizeBytes : null;
  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{title}</p>
      {disk ? (
        <>
          <p className="mt-2 text-2xl font-bold">{formatBytes(disk.availBytes ?? 0)} free</p>
          <div className="my-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label={`${title} used`} aria-valuenow={Math.round((used ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-r ${(used ?? 0) >= 0.9 ? 'bg-red-400' : 'bg-[var(--color-series-1)]'}`} style={{ width: `${(used ?? 0) * 100}%` }} />
          </div>
          <p className="text-xs text-muted">
            {Math.round((used ?? 0) * 100)}% of {formatBytes(disk.sizeBytes)} · {disk.mount} · {disk.device}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      )}
      <p className="mt-2 text-xs text-muted">{holds}</p>
    </div>
  );
}

export default function Storage() {
  const { data, isLoading, isError, error, refetch } = useAdminStorage();
  const settings = useAdminAction('storage');
  const cleanup = useAdminAction('storage');
  const [confirm, setConfirm] = useState(false);
  const [days, setDays] = useState('');

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-6xl" />;
  if (isError || !data) return <Status icon="hard_drive" title="Storage report unavailable" message={errorMessage(error)} action={<Button onClick={() => refetch()}>Retry</Button>} />;

  const save = (body: Record<string, unknown>) =>
    settings.mutate({ method: 'patch', url: '/admin/settings', body }, { onSuccess: () => toast('Cleanup policy saved'), onError: (e) => toast(errorMessage(e)) });
  const { preview } = data.cleanup;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Storage</h1>
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Tier title="Hot storage · SSD" disk={data.tiers.hot.disk} holds={data.tiers.hot.holds} empty="Host metrics unavailable" />
        <Tier title="Cold storage · HDD" disk={data.tiers.cold.disk} holds={data.tiers.cold.holds} empty={data.tiers.cold.path ? `Disk for ${data.tiers.cold.path} not reported` : 'Not set up. Set COLD_STORAGE_DIR to use a second disk.'} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Audio library</p>
          <p className="mt-2 text-2xl font-bold">{formatBytes(data.library.bytes)}</p>
          <p className="mt-1 text-xs text-muted">{data.library.tracks} tracks</p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Database</p>
          <p className="mt-2 text-2xl font-bold">{formatBytes(data.databaseBytes)}</p>
          <p className="mt-1 text-xs text-muted">On hot storage</p>
        </div>
        <div className="col-span-2 rounded-xl bg-surface p-4 md:col-span-1">
          <p className="text-xs uppercase tracking-wider text-muted">Reclaimable now</p>
          <p className="mt-2 text-2xl font-bold">{formatBytes(preview.bytes)}</p>
          <p className="mt-1 text-xs text-muted">{preview.count} unused tracks</p>
        </div>
      </div>

      <section className="mb-8 rounded-xl bg-surface p-4" aria-label="Cleanup policy">
        <h2 className="text-lg font-bold">Cleanup policy</h2>
        <p className="mb-4 text-sm text-muted">Removes tracks older than the window that nobody liked, saved to a playlist or played within it. Runs once a day when on.</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" role="switch" checked={data.cleanup.enabled} onChange={(e) => save({ 'storage.cleanup_enabled': e.target.checked })} className="h-5 w-9 accent-white" />
            Automatic cleanup
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Unused for (days)
            <span className="flex gap-2">
              <input className={`${inputClass} w-28`} type="number" min={7} inputMode="numeric" placeholder={String(data.cleanup.unplayedDays)} value={days} onChange={(e) => setDays(e.target.value)} />
              <Button variant="secondary" disabled={!(Number(days) >= 7)} onClick={() => (save({ 'storage.cleanup_unplayed_days': Math.round(Number(days)) }), setDays(''))}>
                Save
              </Button>
            </span>
          </label>
          <Button variant="danger" className="sm:ml-auto" disabled={!preview.count || cleanup.isPending} onClick={() => setConfirm(true)}>
            Clean up {preview.count} tracks now
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">Last run: {data.cleanup.lastRunAt ? new Date(data.cleanup.lastRunAt).toLocaleString() : 'never'}</p>
        {!!preview.sample.length && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Preview what would be removed</summary>
            <ul className="mt-2 divide-y divide-white/5">
              {preview.sample.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 tabular-nums text-muted">{formatBytes(t.fileSize)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl bg-surface p-4" aria-label="By format">
          <h2 className="mb-3 text-sm font-medium">By format and quality</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {data.byFormat.map((f) => (
              <li key={`${f.format}-${f.quality}`}>
                <div className="flex justify-between gap-3">
                  <span>
                    {f.format ?? 'unknown'} · {f.quality ?? '—'} <span className="text-muted">({f.tracks})</span>
                  </span>
                  <span className="tabular-nums text-muted">{formatBytes(f.bytes)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/5">
                  <div className="h-full rounded-r bg-[var(--color-series-1)]" style={{ width: `${data.library.bytes ? (f.bytes / data.library.bytes) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-surface p-4" aria-label="Largest tracks">
          <h2 className="mb-3 text-sm font-medium">Largest tracks</h2>
          <ol className="divide-y divide-white/5 text-sm">
            {data.largest.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {t.title} <span className="text-muted">· {t.playCount} plays</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatBytes(t.fileSize)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {confirm && (
        <Dialog
          title="Remove unused tracks?"
          onClose={() => setConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirm(false);
                  cleanup.mutate({ method: 'post', url: '/admin/storage/cleanup' }, { onSuccess: (r) => toast(`Removed ${(r as { removed: number }).removed} tracks`), onError: (e) => toast(errorMessage(e)) });
                }}
              >
                Remove
              </Button>
            </>
          }
        >
          <p className="pb-2 text-sm text-muted">
            {preview.count} tracks ({formatBytes(preview.bytes)}) and their audio files will be permanently deleted. Up to 500 are removed per run.
          </p>
        </Dialog>
      )}
    </div>
  );
}

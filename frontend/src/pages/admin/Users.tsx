import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { toast } from '../../lib/toast';
import { Button, Chips, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/format';
import { flat, useAdminAction, useAdminUsers, useUserSessions } from '../../lib/queries';
import { SessionList } from '../../components/SessionList';
import type { AdminUser } from '../../lib/types';
import { useAppSelector } from '../../store';
import { DataList } from './DataList';

const FILTERS = ['all', 'active', 'banned', 'admin'] as const;
const GB = 1024 ** 3;

function StorageCell({ user, onEdit }: { user: AdminUser; onEdit: () => void }) {
  const { usedBytes, quotaBytes, custom } = user.storage;
  const ratio = quotaBytes ? Math.min(usedBytes / quotaBytes, 1) : 0;
  return (
    <button type="button" onClick={onEdit} className="flex min-w-[140px] flex-col gap-1 text-left hover:underline" aria-label={`Edit storage limit for ${user.username}`}>
      <span className="text-xs">
        {formatBytes(usedBytes)} / {quotaBytes ? formatBytes(quotaBytes) : 'Unlimited'}
        {custom && <span className="text-muted"> · custom</span>}
      </span>
      {quotaBytes && (
        <span className="h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className={`block h-full ${ratio >= 0.9 ? 'bg-red-400' : 'bg-sky-400'}`} style={{ width: `${ratio * 100}%` }} />
        </span>
      )}
    </button>
  );
}

const QUALITIES = ['64k', '96k', '128k', '160k', '192k', '256k', '320k'];

function LimitsDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const action = useAdminAction('users');
  const [gb, setGb] = useState(user.storage.custom ? String((user.storage.quotaBytes ?? 0) / GB) : '');
  const [canDownload, setCanDownload] = useState(user.permissions.canDownload);
  const [daily, setDaily] = useState(user.permissions.dailyDownloadLimit === null ? '' : String(user.permissions.dailyDownloadLimit));
  const [maxQuality, setMaxQuality] = useState(user.permissions.maxQuality ?? '');
  const number = (v: string) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const save = () =>
    action.mutate(
      {
        method: 'patch',
        url: `/admin/users/${user.id}`,
        body: {
          storageQuotaBytes: gb.trim() === '' ? null : Math.round(Number(gb) * GB),
          canDownload,
          dailyDownloadLimit: daily.trim() === '' ? null : Math.round(Number(daily)),
          maxQuality: maxQuality || null,
        },
      },
      {
        onSuccess: () => {
          toast('Limits updated');
          onClose();
        },
        onError: (e) => toast(errorMessage(e)),
      },
    );
  return (
    <Dialog
      title={`Limits for ${user.username}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!number(gb) || !number(daily) || action.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <label className="flex items-center justify-between text-sm">
          Can download new songs
          <input type="checkbox" role="switch" checked={canDownload} onChange={(e) => setCanDownload(e.target.checked)} className="h-5 w-9 accent-white" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Storage limit in GB (0 = unlimited, blank = default)
          <input className={inputClass} type="number" min={0} step="0.5" inputMode="decimal" value={gb} onChange={(e) => setGb(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Downloads per day (blank = default)
          <input className={inputClass} type="number" min={0} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Highest audio quality
          <select className={inputClass} value={maxQuality} onChange={(e) => setMaxQuality(e.target.value)}>
            <option value="">No cap</option>
            {QUALITIES.map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">Using {formatBytes(user.storage.usedBytes)}. Over the storage limit new downloads stop; existing tracks stay.</p>
      </div>
    </Dialog>
  );
}

function DevicesDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const sessions = useUserSessions(user.id);
  const action = useAdminAction('users');
  const revoke = (url: string, done: string) => action.mutate({ method: 'delete', url }, { onSuccess: () => (toast(done), sessions.refetch()), onError: (e) => toast(errorMessage(e)) });
  return (
    <Dialog
      title={`${user.username}'s devices`}
      onClose={onClose}
      footer={
        <>
          <Button variant="danger" disabled={!sessions.data?.length} onClick={() => revoke(`/admin/users/${user.id}/sessions`, 'Signed out everywhere')}>
            Sign out everywhere
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <SessionList sessions={sessions.data} loading={sessions.isLoading} onRevoke={(s) => revoke(`/admin/users/${user.id}/sessions/${s.id}`, `Signed out ${s.device}`)} />
      <p className="pb-2 text-xs text-muted">A signed-out device loses access within 15 minutes, when its current access token expires.</p>
    </Dialog>
  );
}

export default function Users() {
  const me = useAppSelector((s) => s.auth.user);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [limits, setLimits] = useState<AdminUser | null>(null);
  const [devices, setDevices] = useState<AdminUser | null>(null);
  const action = useAdminAction('users');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = {
    search: debounced || undefined,
    role: filter === 'admin' ? 'admin' : undefined,
    status: filter === 'active' || filter === 'banned' ? filter : undefined,
  };
  const query = useAdminUsers(params);
  const users = flat(query);

  const run = (method: 'patch' | 'delete', user: AdminUser, body?: unknown, done?: string) =>
    action.mutate(
      { method, url: `/admin/users/${user.id}`, body },
      { onSuccess: () => done && toast(done), onError: (e) => toast(errorMessage(e)) },
    );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className={`${inputClass} sm:max-w-xs`} type="search" placeholder="Search username or email" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Chips options={FILTERS} value={filter} onChange={setFilter} labels={{ all: 'All', active: 'Active', banned: 'Banned', admin: 'Admins' }} />
      </div>
      <DataList
        items={users}
        loading={query.isLoading}
        empty="No users match"
        paged={query}
        columns={[
          {
            header: 'User',
            cell: (u) => (
              <div className="min-w-0">
                <p className="truncate font-medium">{u.username}</p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
            ),
          },
          {
            header: 'Role',
            cell: (u) => (
              <select
                aria-label={`Role for ${u.username}`}
                className="rounded bg-white/10 px-2 py-1 text-sm"
                value={u.role}
                disabled={u.id === me?.id}
                onChange={(e) => run('patch', u, { role: e.target.value }, 'Role updated')}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            ),
          },
          {
            header: 'Status',
            cell: (u) => <span className={`rounded px-2 py-0.5 text-xs ${u.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>{u.isActive ? 'active' : 'banned'}</span>,
          },
          { header: 'Storage', cell: (u) => <StorageCell user={u} onEdit={() => setLimits(u)} /> },
          { header: 'Joined', cell: (u) => new Date(u.createdAt).toLocaleDateString() },
          {
            header: 'Actions',
            cell: (u) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="px-3 py-1" onClick={() => setLimits(u)}>
                  Limits
                </Button>
                <Button variant="secondary" className="px-3 py-1" onClick={() => setDevices(u)}>
                  Devices
                </Button>
                {u.id !== me?.id && (
                  <>
                    <Button variant="secondary" className="px-3 py-1" onClick={() => run('patch', u, { isActive: !u.isActive }, u.isActive ? 'User banned' : 'User unbanned')}>
                      {u.isActive ? 'Ban' : 'Unban'}
                    </Button>
                    <Button variant="danger" className="px-3 py-1" onClick={() => setDeleting(u)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
      {limits && <LimitsDialog user={limits} onClose={() => setLimits(null)} />}
      {devices && <DevicesDialog user={devices} onClose={() => setDevices(null)} />}
      {deleting && (
        <Dialog
          title="Delete user?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  run('delete', deleting, undefined, 'User deleted');
                  setDeleting(null);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="pb-2 text-sm text-muted">
            {deleting.username} and their playlists, likes and history will be removed. Their downloaded tracks stay in the library.
          </p>
        </Dialog>
      )}
    </div>
  );
}

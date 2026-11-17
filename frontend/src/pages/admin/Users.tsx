import { useEffect, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { toast } from '../../lib/toast';
import { Button, Chips, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatBytes } from '../../lib/format';
import { flat, useAdminAction, useAdminUsers } from '../../lib/queries';
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

function QuotaDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const action = useAdminAction('users');
  const [gb, setGb] = useState(user.storage.custom ? String((user.storage.quotaBytes ?? 0) / GB) : '');
  const valid = gb.trim() === '' || (Number.isFinite(Number(gb)) && Number(gb) >= 0);
  const save = (storageQuotaBytes: number | null) =>
    action.mutate(
      { method: 'patch', url: `/admin/users/${user.id}`, body: { storageQuotaBytes } },
      {
        onSuccess: () => {
          toast('Storage limit updated');
          onClose();
        },
        onError: (e) => toast(errorMessage(e)),
      },
    );
  return (
    <Dialog
      title={`Storage limit for ${user.username}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => save(null)} disabled={action.isPending}>
            Use default
          </Button>
          <Button onClick={() => save(gb.trim() === '' ? null : Math.round(Number(gb) * GB))} disabled={!valid || action.isPending}>
            Save
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1 pb-2 text-xs text-muted">
        Limit in GB (0 = unlimited, blank = default)
        <input className={inputClass} type="number" min={0} step="0.5" inputMode="decimal" value={gb} onChange={(e) => setGb(e.target.value)} />
      </label>
      <p className="pb-2 text-xs text-muted">Using {formatBytes(user.storage.usedBytes)}. New downloads stop once the limit is reached; existing tracks stay.</p>
    </Dialog>
  );
}

export default function Users() {
  const me = useAppSelector((s) => s.auth.user);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [quota, setQuota] = useState<AdminUser | null>(null);
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
          { header: 'Storage', cell: (u) => <StorageCell user={u} onEdit={() => setQuota(u)} /> },
          { header: 'Joined', cell: (u) => new Date(u.createdAt).toLocaleDateString() },
          {
            header: 'Actions',
            cell: (u) =>
              u.id === me?.id ? (
                <span className="text-xs text-muted">You</span>
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1" onClick={() => run('patch', u, { isActive: !u.isActive }, u.isActive ? 'User banned' : 'User unbanned')}>
                    {u.isActive ? 'Ban' : 'Unban'}
                  </Button>
                  <Button variant="danger" className="px-3 py-1" onClick={() => setDeleting(u)}>
                    Delete
                  </Button>
                </div>
              ),
          },
        ]}
      />
      {quota && <QuotaDialog user={quota} onClose={() => setQuota(null)} />}
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

import { useState } from 'react';
import { toast } from '../../lib/toast';
import { Button, Chips, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useProgress } from '../../lib/progress';
import { useAdminAction, useAdminDownloads, useCreateDownload } from '../../lib/queries';
import type { ProgressEvent, Task } from '../../lib/types';
import { DataList } from './DataList';
import { usePager } from './usePager';

const TABS = ['queue', 'completed', 'failed', 'cancelled', 'all'] as const;
type Tab = (typeof TABS)[number];
const TAB_STATUS: Record<Tab, string | undefined> = {
  queue: 'queued,downloading,uploading',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
  all: undefined,
};

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-yellow-500/15 text-yellow-300',
  downloading: 'bg-sky-500/15 text-sky-300',
  uploading: 'bg-sky-500/15 text-sky-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-white/10 text-muted',
};

export default function Downloads() {
  const [tab, setTab] = useState<Tab>('queue');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<Record<string, ProgressEvent>>({});
  const query = useAdminDownloads({ status: TAB_STATUS[tab] });
  const action = useAdminAction('downloads');
  const create = useCreateDownload();
  const { items: pageItems, pager } = usePager(query, tab);
  const tasks: Task[] = pageItems.map((t) =>
    live[t.id] ? { ...t, status: live[t.id].status, progress: live[t.id].progress ?? t.progress, title: live[t.id].title ?? t.title } : t,
  );

  useProgress((event) => {
    setLive((prev) => ({ ...prev, [event.taskId]: event }));
    if (['completed', 'failed', 'cancelled'].includes(event.status)) query.refetch();
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const act = (path: string, body?: unknown, done?: string) =>
    action.mutate(
      { method: 'post', url: path, body },
      {
        onSuccess: () => {
          if (done) toast(done);
          setSelected(new Set());
        },
        onError: (e) => toast(errorMessage(e)),
      },
    );

  async function queue() {
    try {
      await create.mutateAsync({ url: url.trim() });
      setUrl('');
      setTab('queue');
      query.refetch();
      toast('Download queued');
    } catch (e) {
      toast(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Downloads</h1>
      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) queue();
        }}
      >
        <input className={inputClass} type="url" placeholder="Paste a YouTube or SoundCloud URL" aria-label="Download URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" disabled={!url.trim() || create.isPending}>
          Queue
        </Button>
      </form>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Chips
          options={TABS}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setSelected(new Set());
          }}
          labels={{ queue: 'Queue', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', all: 'All' }}
        />
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{selected.size} selected</span>
            {(['cancel', 'retry', 'delete'] as const).map((bulk) => (
              <Button key={bulk} variant={bulk === 'delete' ? 'danger' : 'secondary'} className="px-3 py-1 capitalize" onClick={() => act('/admin/downloads/bulk', { action: bulk, ids: [...selected] }, `${bulk} applied`)}>
                {bulk}
              </Button>
            ))}
          </div>
        )}
      </div>
      <DataList
        items={tasks}
        loading={query.isLoading}
        empty="No downloads here"
        selected={selected}
        onToggle={toggle}
        onToggleAll={() => setSelected(tasks.every((t) => selected.has(t.id)) ? new Set() : new Set(tasks.map((t) => t.id)))}
        pager={pager}
        columns={[
          {
            header: 'Track',
            cell: (t) => (
              <div className="min-w-0">
                <p className="truncate font-medium">{t.title ?? 'Resolving…'}</p>
                <a href={t.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted hover:underline">
                  {t.url}
                </a>
                {t.errorMessage && <p className="truncate text-xs text-red-400">{t.errorMessage}</p>}
              </div>
            ),
          },
          { header: 'User', cell: (t) => t.username ?? '—' },
          {
            header: 'Status',
            cell: (t) => (
              <div className="flex min-w-[120px] flex-col gap-1">
                <span className={`w-fit rounded px-2 py-0.5 text-xs ${STATUS_STYLE[t.status] ?? ''}`}>{t.status}</span>
                {(t.status === 'downloading' || t.status === 'uploading') && (
                  <div className="h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-sky-400" style={{ width: `${t.progress}%` }} />
                  </div>
                )}
              </div>
            ),
          },
          { header: 'Retries', cell: (t) => t.retryCount },
          { header: 'Requested', cell: (t) => new Date(t.createdAt).toLocaleString() },
          {
            header: 'Actions',
            cell: (t) => (
              <div className="flex gap-2">
                {['queued', 'downloading', 'uploading'].includes(t.status) && (
                  <Button variant="secondary" className="px-3 py-1" onClick={() => act(`/admin/downloads/${t.id}/cancel`, undefined, 'Cancelled')}>
                    Cancel
                  </Button>
                )}
                {['failed', 'cancelled'].includes(t.status) && (
                  <Button variant="secondary" className="px-3 py-1" onClick={() => act(`/admin/downloads/${t.id}/retry`, undefined, 'Retry queued')}>
                    Retry
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

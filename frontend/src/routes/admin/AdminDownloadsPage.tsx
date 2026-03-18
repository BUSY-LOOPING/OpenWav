import { useState } from 'react';
import { useAdminDownloads, useCancelDownload } from '../../hooks/useAdminQueries';

const TABS = ['Queue', 'History', 'Failed'];

const STATUS_MAP: Record<string, string[]> = {
  Queue:   ['queued', 'downloading'],
  History: ['completed'],
  Failed:  ['failed'],
};

const STATUS_STYLES: Record<string, string> = {
  completed:   'text-emerald-400 bg-emerald-400/10',
  downloading: 'text-blue-400 bg-blue-400/10',
  queued:      'text-yellow-400 bg-yellow-400/10',
  failed:      'text-red-400 bg-red-400/10',
  cancelled:   'text-[#666] bg-white/5',
};

export default function AdminDownloadsPage() {
  const [activeTab, setActiveTab] = useState('Queue');
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useState(25);

  const status = STATUS_MAP[activeTab];

  const { data, isLoading, isError } = useAdminDownloads({
    status: status.length === 1 ? status[0] : undefined,
    page,
    limit,
    sortOrder: 'DESC',
  });

  const cancelDownload = useCancelDownload();

  const tasks      = data?.tasks ?? [];
  const pagination = data?.pagination;

  const filtered = status.length > 1
    ? tasks.filter((t: any) => status.includes(t.status))
    : tasks;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-6">
          {TABS.map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-[#777] hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-[#666]">
          <span>Per page</span>
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            className="bg-[#111] border border-white/[0.08] text-white text-sm px-2 py-1 rounded outline-none">
            {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{activeTab}</h1>
          {activeTab === 'Failed' && (
            <p className="text-xs text-[#555]">Failed jobs are retried automatically up to 3 times via RabbitMQ DLQ</p>
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-6 p-3 bg-red-400/5 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">error</span>
            Failed to load download tasks
          </div>
        )}

        {!isLoading && filtered.length === 0 && !isError && (
          <div className="flex flex-col items-center justify-center py-24 text-[#444]">
            <span className="material-symbols-outlined text-5xl mb-3">inbox</span>
            <p className="text-sm">No {activeTab.toLowerCase()} downloads</p>
          </div>
        )}

        {(isLoading || filtered.length > 0) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="text-xs text-[#555] uppercase tracking-wider border-b border-white/[0.06]">
                  {['Title / URL', 'User', 'Format', 'Status', 'Retries', 'Requested', ''].map(h => (
                    <th key={h} className="pb-3 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/[0.04]">
                        {[200, 80, 80, 70, 40, 100, 20].map((w, j) => (
                          <td key={j} className="py-4 px-2">
                            <div className="h-3 bg-white/[0.06] rounded animate-pulse" style={{ width: w }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map((task: any) => (
                      <tr key={task.id} className="group border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                        <td className="py-4 px-2 max-w-[220px]">
                          <p className="text-white text-sm font-medium truncate">{task.mediaTitle ?? 'Unknown'}</p>
                          <p className="text-[#555] text-xs truncate mt-0.5">{task.url}</p>
                        </td>
                        <td className="py-4 px-2 text-[#888] text-sm">{task.username ?? '—'}</td>
                        <td className="py-4 px-2">
                          <span className="text-xs font-mono bg-white/[0.06] px-2 py-0.5 rounded text-[#aaa]">
                            {task.format} · {task.quality}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          {task.status === 'downloading' ? (
                            <div className="flex flex-col gap-1.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded w-fit ${STATUS_STYLES[task.status]}`}>{task.status}</span>
                              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${task.progress ?? 0}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[task.status] ?? ''}`}>{task.status}</span>
                          )}
                        </td>
                        <td className="py-4 px-2 text-[#888] text-sm">{task.retryCount ?? 0}</td>
                        <td className="py-4 px-2 text-[#888] text-xs whitespace-nowrap">
                          {new Date(task.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4 px-2 text-right">
                          {['queued', 'downloading'].includes(task.status) && (
                            <button
                              onClick={() => cancelDownload.mutate(task.id)}
                              disabled={cancelDownload.isPending}
                              className="text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5">
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center gap-3 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors">Prev</button>
            <span className="text-sm text-[#555]">{page} / {pagination.pages}</span>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
              className="px-3 py-1.5 text-sm bg-white/[0.06] hover:bg-white/10 rounded-lg text-white disabled:opacity-30 transition-colors">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
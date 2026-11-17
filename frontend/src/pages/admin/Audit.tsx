import { useEffect, useState } from 'react';
import { inputClass } from '../../components/ui';
import { flat, useAdminAudit } from '../../lib/queries';
import { DataList } from './DataList';

const summary = (details: Record<string, unknown> | null) =>
  details
    ? Object.entries(details)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' · ')
    : '';

export default function Audit() {
  const [action, setAction] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(action.trim()), 300);
    return () => clearTimeout(t);
  }, [action]);
  const query = useAdminAudit({ action: debounced || undefined });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-2 text-2xl font-bold">Audit log</h1>
      <p className="mb-6 text-sm text-muted">Every change made from the admin console: who, what and when.</p>
      <input className={`${inputClass} mb-6 sm:max-w-xs`} type="search" placeholder="Filter by action, e.g. user or settings" aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} />
      <DataList
        items={flat(query)}
        loading={query.isLoading}
        empty="No admin actions recorded"
        paged={query}
        columns={[
          { header: 'When', cell: (a) => <span className="tabular-nums">{new Date(a.createdAt).toLocaleString()}</span> },
          { header: 'Who', cell: (a) => a.actor ?? 'Deleted user' },
          { header: 'Action', cell: (a) => <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{a.action}</span> },
          {
            header: 'Details',
            cell: (a) => (
              <span className="block max-w-md truncate text-xs text-muted" title={summary(a.details)}>
                {[a.targetType && `${a.targetType} ${a.targetId ?? ''}`.trim(), summary(a.details)].filter(Boolean).join(' · ') || '—'}
              </span>
            ),
          },
          { header: 'IP', cell: (a) => <span className="font-mono text-xs text-muted">{a.ip ?? '—'}</span> },
        ]}
      />
    </div>
  );
}

import type { ReactNode } from 'react';
import { IconButton, Skeleton, Spinner, Status } from '../../components/ui';

import type { Pager } from './usePager';

export interface Column<T> {
  header: string;
  cell: (item: T) => ReactNode;
  className?: string;
}

interface DataListProps<T extends { id: string }> {
  items: T[];
  columns: Column<T>[];
  loading: boolean;
  empty: string;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  pager?: Pager;
}

export function DataList<T extends { id: string }>({ items, columns, loading, empty, selected, onToggle, onToggleAll, pager }: DataListProps<T>) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!items.length) return <Status icon="inbox" title={empty} />;
  const allSelected = !!selected && items.every((i) => selected.has(i.id));

  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-muted">
          <tr>
            {onToggle && (
              <th className="w-10 py-3">
                <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={onToggleAll} className="accent-white" />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.header} className={`px-2 py-3 font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.03]">
              {onToggle && (
                <td className="py-3">
                  <input type="checkbox" aria-label="Select row" checked={selected?.has(item.id) ?? false} onChange={() => onToggle(item.id)} className="accent-white" />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.header} className={`max-w-xs px-2 py-3 align-middle ${c.className ?? ''}`}>
                  {c.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg bg-surface p-4">
            {onToggle && (
              <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={selected?.has(item.id) ?? false} onChange={() => onToggle(item.id)} className="accent-white" /> Select
              </label>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {columns.map((c) => (
                <div key={c.header} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="min-w-0 break-words">{c.cell(item)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {pager && (pager.hasPrev || pager.hasNext) && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-end gap-2 text-sm text-muted">
          {pager.loading && <Spinner className="h-4 w-4" />}
          <IconButton icon="chevron_left" label="Previous page" disabled={!pager.hasPrev || pager.loading} onClick={pager.onPrev} />
          <span className="tabular-nums">Page {pager.page}</span>
          <IconButton icon="chevron_right" label="Next page" disabled={!pager.hasNext || pager.loading} onClick={pager.onNext} />
        </nav>
      )}
    </>
  );
}

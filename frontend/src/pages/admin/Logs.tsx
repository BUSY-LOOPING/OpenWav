import { useEffect, useState } from 'react';
import { Chips, Skeleton, Status, inputClass } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminLogs } from '../../lib/queries';
import type { LogLine } from '../../lib/types';
import { SERVICES, WINDOWS, type Window } from './observability';

const LEVEL_STYLE: Record<string, string> = { error: 'text-red-300', fatal: 'text-red-300', critical: 'text-red-300', warn: 'text-yellow-300', warning: 'text-yellow-300' };

function message(line: string) {
  try {
    const parsed = JSON.parse(line);
    return typeof parsed.msg === 'string' ? parsed.msg : typeof parsed.message === 'string' ? parsed.message : line;
  } catch {
    return line;
  }
}

function Row({ log }: { log: LogLine }) {
  const level = log.level?.toLowerCase() ?? '';
  return (
    <li className="border-b border-white/5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline gap-3 px-2 py-1.5 font-mono text-xs hover:bg-white/[0.03]">
          <span className="shrink-0 tabular-nums text-muted">{new Date(log.at).toLocaleTimeString()}</span>
          <span className="w-20 shrink-0 truncate text-sky-300">{log.service ?? '—'}</span>
          <span className={`w-12 shrink-0 uppercase ${LEVEL_STYLE[level] ?? 'text-muted'}`}>{level || '—'}</span>
          <span className="min-w-0 flex-1 truncate">{message(log.line)}</span>
        </summary>
        <pre className="thin-scrollbar overflow-x-auto whitespace-pre-wrap break-all bg-black/30 px-3 py-2 font-mono text-xs text-muted">{log.line}</pre>
      </details>
    </li>
  );
}

export default function Logs() {
  const [service, setService] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [window, setWindow] = useState<Window>('1h');
  const [live, setLive] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data = [], isLoading, isError, error } = useAdminLogs({ service: service || undefined, errorsOnly, search: debounced || undefined, sinceSec: WINDOWS[window], limit: 200 }, live);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Logs</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select aria-label="Service" className="rounded bg-white/10 px-3 py-2 text-sm" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All services</option>
          {[...SERVICES, 'nginx', 'postgres', 'rabbitmq', 'redis'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input className={`${inputClass} sm:max-w-xs`} type="search" placeholder="Contains text" aria-label="Search logs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Chips options={Object.keys(WINDOWS) as Window[]} value={window} onChange={setWindow} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} className="accent-white" /> Errors only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" role="switch" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-white" /> Live
        </label>
      </div>
      {isError ? (
        <Status icon="article" title="Logs unavailable" message={errorMessage(error)} />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data.length ? (
        <Status icon="article" title="No log lines in this window" />
      ) : (
        <ul className="rounded-xl bg-surface" aria-label="Log lines">
          {data.map((log, i) => (
            <Row key={`${log.at}-${i}`} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}

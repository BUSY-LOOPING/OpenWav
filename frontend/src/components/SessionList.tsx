import { Button, Icon, Spinner } from './ui';
import type { Session } from '../lib/types';

const ICONS: [RegExp, string][] = [
  [/iOS|Android/, 'smartphone'],
  [/macOS|Windows|Linux|ChromeOS/, 'computer'],
];

export function SessionList({ sessions, loading, onRevoke }: { sessions: Session[] | undefined; loading: boolean; onRevoke: (s: Session) => void }) {
  if (loading) return <Spinner className="mx-auto my-4" />;
  if (!sessions?.length) return <p className="py-4 text-center text-sm text-muted">No signed-in devices.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-3">
          <Icon name={ICONS.find(([re]) => re.test(s.device))?.[1] ?? 'devices'} className="text-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {s.device}
              {s.current && <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">This device</span>}
            </p>
            <p className="truncate text-xs text-muted" title={s.userAgent ?? undefined}>
              Active {new Date(s.lastActiveAt).toLocaleString()} · signed in {new Date(s.startedAt).toLocaleDateString()}
              {s.ip ? ` · ${s.ip}` : ''}
            </p>
          </div>
          {!s.current && (
            <Button variant="secondary" className="px-3 py-1" onClick={() => onRevoke(s)}>
              Sign out
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

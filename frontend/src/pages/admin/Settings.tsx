import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '../../lib/toast';
import { Button, Skeleton, Status, inputClass } from '../../components/ui';
import { errorMessage, send } from '../../lib/api';
import { useAdminAction, useAdminCookies, useAdminSettings } from '../../lib/queries';
import type { Settings } from '../../lib/types';

const FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav'];
const QUALITIES = ['64k', '96k', '128k', '160k', '192k', '256k', '320k'];
const EVENT_TYPES = [
  'play_start',
  'play_progress',
  'play_complete',
  'skip',
  'like',
  'unlike',
  'search',
  'add_to_playlist',
  'remove_from_playlist',
  'download_request',
  'page_view',
];

type Field =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; hint?: string }
  | { key: string; label: string; type: 'boolean'; hint?: string }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'list'; hint?: string }
  | { key: string; label: string; type: 'multi'; options: string[] };

const GROUPS: { id: string; title: string; fields: Field[] }[] = [
  {
    id: 'downloads',
    title: 'Downloads',
    fields: [
      { key: 'downloads.max_per_user_per_day', label: 'Max downloads per user per day', type: 'number', min: 0 },
      { key: 'downloads.allowed_domains', label: 'Allowed domains', type: 'list', hint: 'One per line' },
      { key: 'downloads.default_format', label: 'Default format', type: 'select', options: FORMATS },
      { key: 'downloads.default_quality', label: 'Default quality', type: 'select', options: QUALITIES },
    ],
  },
  { id: 'auth', title: 'Accounts', fields: [{ key: 'auth.registration_enabled', label: 'Allow new registrations', type: 'boolean' }] },
  {
    id: 'ratelimit',
    title: 'Rate limits',
    fields: [
      { key: 'ratelimit.global_per_minute', label: 'Requests per minute per client', type: 'number', min: 1 },
      { key: 'ratelimit.auth_per_15min', label: 'Auth attempts per 15 minutes', type: 'number', min: 1 },
      { key: 'ratelimit.downloads_per_hour', label: 'Download requests per hour per user', type: 'number', min: 1 },
    ],
  },
  {
    id: 'events',
    title: 'Event tracking',
    fields: [
      { key: 'events.enabled', label: 'Collect listening events', type: 'boolean' },
      { key: 'events.sample_rate', label: 'Sample rate', type: 'number', min: 0, max: 1, step: 0.05, hint: '1 keeps every event' },
      { key: 'events.types', label: 'Tracked event types', type: 'multi', options: EVENT_TYPES },
      { key: 'events.retention_days', label: 'Retention (days)', type: 'number', min: 1 },
    ],
  },
  {
    id: 'recommender',
    title: 'Recommendations',
    fields: [
      { key: 'recommender.enabled', label: 'Personalised recommendations', type: 'boolean' },
      { key: 'recommender.blend_content_weight', label: 'Content similarity weight', type: 'number', min: 0, max: 1, step: 0.05, hint: '0 = collaborative only, 1 = tags/artists only' },
    ],
  },
  {
    id: 'alerts',
    title: 'Alert thresholds',
    fields: [
      { key: 'alerts.p95_ms', label: 'HTTP P95 latency (ms)', type: 'number', min: 1 },
      { key: 'alerts.p99_ms', label: 'HTTP P99 latency (ms)', type: 'number', min: 1 },
    ],
  },
  {
    id: 'discovery',
    title: 'Auto-discovery',
    fields: [
      { key: 'discovery.enabled', label: 'Auto-download top tracks on a schedule', type: 'boolean' },
      { key: 'discovery.interval_hours', label: 'Run every (hours)', type: 'number', min: 1 },
      { key: 'discovery.per_source', label: 'Tracks per source', type: 'number', min: 1, max: 50 },
      { key: 'discovery.country', label: 'Charts country', type: 'select', options: ['ZZ', 'US', 'GB', 'IN', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'BR', 'MX'] },
      { key: 'discovery.genres', label: 'Genres', type: 'list', hint: 'One per line, searched as "top <genre> songs"' },
      { key: 'discovery.top_artists', label: 'Top library artists to follow', type: 'number', min: 0, max: 50 },
      { key: 'discovery.queries', label: 'Picks (search queries)', type: 'list', hint: 'One per line' },
      { key: 'discovery.playlists', label: 'Playlists to import', type: 'list', hint: 'One playlist URL per line' },
    ],
  },
];

const KEEP_COOKIE = /^(#HttpOnly_)?\.?([\w-]+\.)*(youtube|google)\.com\t/;

function CookiesCard() {
  const { data } = useAdminCookies();
  const action = useAdminAction('cookies');
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const content = (await file.text()).split(/\r?\n/).filter((l) => KEEP_COOKIE.test(l)).join('\n');
    action.mutate({ method: 'put', url: '/admin/ytdlp/cookies', body: { content: content || ' ' } }, { onSuccess: () => toast('Cookies saved, downloads use them within 30 seconds'), onError: (e) => toast(errorMessage(e)) });
  };
  const expired = !!data?.expiresAt && Date.parse(data.expiresAt) < Date.now();

  return (
    <section id="cookies" aria-label="YouTube cookies" className="mb-6 rounded-xl bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-bold">YouTube cookies</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Fixes "Sign in to confirm you're not a bot" and HTTP 403 errors. Upload a Netscape <code>cookies.txt</code> exported while signed in to YouTube, ideally with a spare account. Only youtube.com and google.com cookies are kept, and they are never shown again.
      </p>
      {data?.configured ? (
        <p className={`mb-4 text-sm ${expired ? 'text-red-400' : 'text-emerald-300'}`}>
          {data.entries} cookies for {data.domains.join(', ')} · uploaded {new Date(data.updatedAt!).toLocaleString()}
          {data.expiresAt && ` · ${expired ? 'expired' : 'earliest expiry'} ${new Date(data.expiresAt).toLocaleDateString()}`}
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">No cookies uploaded. Downloads run signed out.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
          {data?.configured ? 'Replace cookies.txt' : 'Upload cookies.txt'}
          <input type="file" accept=".txt,text/plain" className="sr-only" disabled={action.isPending} onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ''))} />
        </label>
        {data?.configured && (
          <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate({ method: 'delete', url: '/admin/ytdlp/cookies' }, { onSuccess: () => toast('Cookies removed') })}>
            Remove
          </Button>
        )}
      </div>
    </section>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = `setting-${field.key}`;
  if (field.type === 'boolean')
    return <input id={id} type="checkbox" role="switch" className="h-5 w-9 accent-white" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  if (field.type === 'select')
    return (
      <select id={id} className={`${inputClass} sm:w-48`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (field.type === 'list')
    return (
      <textarea
        id={id}
        rows={4}
        className={`${inputClass} sm:w-72`}
        value={Array.isArray(value) ? value.join('\n') : ''}
        onChange={(e) => onChange(e.target.value.split('\n').map((v) => v.trim()).filter(Boolean))}
      />
    );
  if (field.type === 'multi') {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return (
      <div id={id} className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {field.options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-white"
              checked={selected.has(o)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(o);
                else next.delete(o);
                onChange(field.options.filter((x) => next.has(x)));
              }}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      id={id}
      type="number"
      className={`${inputClass} sm:w-48`}
      min={field.min}
      max={field.max}
      step={field.step ?? 1}
      value={value === undefined || value === null ? '' : Number(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

export default function AdminSettings() {
  const { data, isLoading, isError } = useAdminSettings();
  const save = useAdminAction('settings');
  const retrain = useMutation({ mutationFn: () => send('post', '/admin/recommender/retrain') });
  const [draft, setDraft] = useState<Settings>({});

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <Status icon="error" title="Couldn't load settings" />;

  function submit(group: (typeof GROUPS)[number]) {
    const body = Object.fromEntries(group.fields.map((f) => [f.key, draft[f.key]]));
    save.mutate({ method: 'patch', url: '/admin/settings', body }, { onSuccess: () => toast(`${group.title} saved`), onError: (e) => toast(errorMessage(e)) });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <CookiesCard />
      {GROUPS.map((group) => {
        const dirty = group.fields.some((f) => JSON.stringify(draft[f.key]) !== JSON.stringify(data?.[f.key]));
        return (
          <form
            key={group.id}
            id={group.id}
            aria-label={group.title}
            className="mb-6 rounded-xl bg-surface p-4 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit(group);
            }}
          >
            <h2 className="mb-4 text-lg font-bold">{group.title}</h2>
            <div className="flex flex-col gap-5">
              {group.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <label htmlFor={`setting-${field.key}`} className="text-sm">
                    {field.label}
                    {'hint' in field && field.hint && <span className="block text-xs text-muted">{field.hint}</span>}
                  </label>
                  <FieldInput field={field} value={draft[field.key]} onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))} />
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {group.id === 'recommender' && (
                <Button variant="secondary" onClick={() => retrain.mutate(undefined, { onSuccess: () => toast('Retraining started'), onError: (e) => toast(errorMessage(e)) })} disabled={retrain.isPending}>
                  Retrain now
                </Button>
              )}
              <Button type="submit" disabled={!dirty || save.isPending}>
                Save
              </Button>
            </div>
          </form>
        );
      })}
    </div>
  );
}

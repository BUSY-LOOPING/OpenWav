import { useState } from 'react';
import { LineChart, RankList } from '../../components/LineChart';
import { Chips, Skeleton, Status } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAdminAnalytics } from '../../lib/queries';

const WINDOWS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 } as const;

export default function Analytics() {
  const [window, setWindow] = useState<keyof typeof WINDOWS>('30d');
  const { data, isLoading, isError, error } = useAdminAnalytics(WINDOWS[window]);
  const series = (key: 'plays' | 'listeners' | 'downloads' | 'signups') => (data?.daily ?? []).map((d) => [Date.parse(`${d.day}T00:00:00Z`) / 1000, d[key]] as [number, number]);
  const count = (v: number) => String(Math.round(v));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Chips options={Object.keys(WINDOWS) as (keyof typeof WINDOWS)[]} value={window} onChange={setWindow} />
      </div>
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : isError || !data ? (
        <Status icon="insights" title="Analytics unavailable" message={errorMessage(error)} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Plays', data.totals.plays],
              ['Listeners', data.totals.listeners],
              ['Plays per listener', data.totals.listeners ? (data.totals.plays / data.totals.listeners).toFixed(1) : '—'],
              ['Downloads', data.daily.reduce((n, d) => n + d.downloads, 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <LineChart title="Plays per day" format={count} series={[{ label: 'Plays', points: series('plays') }]} />
            <LineChart title="Listeners per day" format={count} series={[{ label: 'Listeners', points: series('listeners') }]} />
            <LineChart title="Downloads per day" format={count} series={[{ label: 'Downloads', points: series('downloads') }]} />
            <LineChart title="New users per day" format={count} series={[{ label: 'Sign-ups', points: series('signups') }]} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <RankList title="Top tracks" rows={data.topTracks.map((t) => ({ key: t.id, label: t.title, value: t.plays, hint: `${t.listeners} listeners` }))} format={count} />
            <RankList title="Top artists" rows={data.topArtists.map((a) => ({ key: a.id, label: a.name, value: a.plays }))} format={count} />
            <RankList title="Most active listeners" rows={data.topUsers.map((u) => ({ key: u.id, label: u.username, value: u.plays }))} format={count} />
            <RankList title="Searches with no results" rows={data.searchMisses.map((m) => ({ key: m.term, label: m.term, value: m.count }))} format={count} empty="Every search found something" />
          </div>
        </>
      )}
    </div>
  );
}

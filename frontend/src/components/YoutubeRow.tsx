import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../lib/toast';
import type { YoutubeResult } from '../lib/types';
import { Menu, type MenuItem } from './Menu';
import { SaveToPlaylistDialog } from './PlaylistDialogs';
import { Icon, IconButton, Thumb } from './ui';
import { formatTime } from '../lib/format';
import { usePlayResult, ytFallback } from './youtubeResult';

const STATUS_LABEL: Record<string, string> = { queued: 'Waiting to download', downloading: 'Downloading', uploading: 'Saving' };

// Same slots as TrackRow so library and YouTube rows line up in one list
export function YoutubeRow({ result, autoPlay = 0, error = null }: { result: YoutubeResult; autoPlay?: number; error?: string | null }) {
  const { play, run, mediaId, busy, percent, status, error: failed } = usePlayResult(result);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const played = useRef(0);
  const wide = result.type === 'video';

  useEffect(() => {
    if (autoPlay > played.current) {
      played.current = autoPlay;
      play();
    }
  }, [autoPlay]);

  const items: MenuItem[] = [
    { label: mediaId ? 'Play' : 'Download and play', icon: 'play_arrow', onSelect: play },
    { label: mediaId ? 'Play next' : 'Download and play next', icon: 'playlist_play', onSelect: () => run('next') },
    { label: mediaId ? 'Add to queue' : 'Download and add to queue', icon: 'queue_music', onSelect: () => run('queue') },
    ...(mediaId
      ? [
          { label: 'Save to playlist', icon: 'playlist_add', onSelect: () => setSaving(true), divider: true },
          { label: 'Go to song', icon: 'music_note', onSelect: () => navigate(`/watch/${mediaId}`) },
        ]
      : [{ label: 'Download to library', icon: 'download', onSelect: () => run('download'), divider: true }]),
    ...(result.artists?.[0] ? [{ label: 'Search artist', icon: 'person', onSelect: () => navigate(`/search?q=${encodeURIComponent(result.artists![0])}`) }] : []),
    { label: 'Open on YouTube', icon: 'open_in_new', onSelect: () => window.open(result.url, '_blank', 'noopener'), divider: true },
    {
      label: 'Copy YouTube link',
      icon: 'link',
      onSelect: () => {
        navigator.clipboard?.writeText(result.url).catch(() => undefined);
        toast('Link copied to clipboard');
      },
    },
  ];

  const problem = busy ? null : (failed ?? (mediaId ? null : error));
  const subtitle = [result.artists?.length ? result.artists.join(', ') : result.channel, result.type === 'video' ? 'Video' : null].filter(Boolean).join(' • ');

  return (
    <div role="row" className="group flex min-h-14 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/10 sm:px-3">
      <button type="button" onClick={play} disabled={busy} aria-label={busy ? `Downloading ${result.title}` : `Play ${result.title}`} className={`relative h-10 shrink-0 overflow-hidden rounded sm:h-12 ${wide ? 'w-16 sm:w-20' : 'w-10 sm:w-12'}`}>
        <Thumb src={result.thumbnailUrl} fallback={ytFallback(result.videoId)} alt="" className="h-full w-full" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${busy ? '' : 'opacity-0 group-hover:opacity-100'}`}>
          {busy ? <span className="text-xs font-bold tabular-nums">{Math.round(percent)}%</span> : <Icon name="play_arrow" fill />}
        </span>
      </button>
      <div className="min-w-0 flex-1 cursor-default" onClick={busy ? undefined : play}>
        <p className="truncate text-sm font-medium">{result.title}</p>
        <p className={`truncate text-sm ${problem ? 'text-red-300' : 'text-muted'}`}>
          {problem ?? (busy ? STATUS_LABEL[status ?? 'queued'] : subtitle || (mediaId ? 'In library' : ''))}
          {!problem && !busy && result.album && <span className="lg:hidden"> • {result.album}</span>}
        </p>
        {busy && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-label={`Downloading ${result.title}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <span className="hidden w-1/4 truncate text-sm text-muted lg:block">{result.album ?? ''}</span>
      <span className="hidden w-12 text-right text-sm text-muted tabular-nums sm:block">{result.durationSec ? formatTime(result.durationSec) : ''}</span>
      <Menu label={`Actions for ${result.title}`} items={items} trigger={(props) => <IconButton {...props} icon="more_vert" label="More actions" className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" />} />
      {saving && mediaId && <SaveToPlaylistDialog mediaId={mediaId} onClose={() => setSaving(false)} />}
    </div>
  );
}

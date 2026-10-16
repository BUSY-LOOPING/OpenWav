import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../lib/toast';
import { errorMessage, get, send } from '../lib/api';
import { formatTime } from '../lib/format';
import { useTaskProgress } from '../lib/progress';
import { keys, useCreateDownload } from '../lib/queries';
import type { Task, Track, YoutubeResult } from '../lib/types';
import { addToQueue, playNext, playTracks } from '../store/player';
import { useAppDispatch } from '../store';
import { Menu, type MenuItem } from './Menu';
import { SaveToPlaylistDialog } from './PlaylistDialogs';
import { Icon, IconButton, Thumb } from './ui';

export const ytFallback = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
export const subtitleOf = (r: YoutubeResult) =>
  [r.type === 'video' ? 'Video' : 'Song', r.artists?.length ? r.artists.join(', ') : r.channel, r.views && `${r.views} ${r.type === 'video' ? 'views' : 'plays'}`, r.durationSec && formatTime(r.durationSec)]
    .filter(Boolean)
    .join(' • ');

type Intent = 'play' | 'next' | 'queue' | 'download';

export function usePlayResult(result: YoutubeResult) {
  const dispatch = useAppDispatch();
  const download = useCreateDownload();
  const [pending, setPending] = useState<{ taskId: string; intent: Intent } | null>(null);
  const [mediaId, setMediaId] = useState(result.mediaId ?? null);
  const progress = useTaskProgress(pending ? [pending.taskId] : [])[pending?.taskId ?? ''];

  const act = async (id: string, intent: Intent) => {
    setMediaId(id);
    if (intent === 'download') return toast(`${result.title} is in your library`);
    const track = await get<Track>(`/media/${id}`);
    if (intent === 'play') return dispatch(playTracks({ tracks: [track] }));
    dispatch(intent === 'next' ? playNext(track) : addToQueue(track));
    toast(intent === 'next' ? 'Song will play next' : 'Song added to queue');
  };

  useEffect(() => {
    if (!pending || !progress) return;
    if (progress.status === 'completed') {
      get<Task>(`/downloads/${pending.taskId}`)
        .then((task) => (task.mediaId ? act(task.mediaId, pending.intent) : undefined))
        .catch((e) => toast(errorMessage(e)))
        .finally(() => setPending(null));
    }
    if (progress.status === 'failed' || progress.status === 'cancelled') {
      toast(progress.error ?? 'Download failed');
      setPending(null);
    }
  }, [progress, pending]);

  async function run(intent: Intent = 'play') {
    try {
      if (mediaId) return await act(mediaId, intent);
      const response = await download.mutateAsync({ url: result.url });
      if (response.mediaId) return await act(response.mediaId, intent);
      if (response.taskId) {
        setPending({ taskId: response.taskId, intent });
        if (intent !== 'play') toast(`Downloading ${result.title}`);
      }
    } catch (e) {
      toast(errorMessage(e, 'Could not start download'));
    }
  }

  return { play: () => run('play'), run, mediaId, busy: !!pending || download.isPending, percent: progress?.progress ?? 0, status: progress?.status };
}

export function useImport() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (url: string | null, name: string) => {
    if (!url) return toast('This album cannot be imported');
    try {
      const { playlistId } = await send<{ playlistId: string }>('post', '/playlists/import', { url, name });
      qc.invalidateQueries({ queryKey: keys.myPlaylists });
      toast(`Importing ${name}`);
      navigate(`/playlist/${playlistId}`);
    } catch (e) {
      toast(errorMessage(e, 'Import failed'));
    }
  };
}

export function YoutubeRow({ result, autoPlay = 0 }: { result: YoutubeResult; autoPlay?: number }) {
  const { play, run, mediaId, busy, percent, status } = usePlayResult(result);
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

  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/10 sm:px-3">
      <button type="button" onClick={play} disabled={busy} aria-label={busy ? `Downloading ${result.title}` : `Play ${result.title}`} className={`relative h-12 shrink-0 overflow-hidden rounded ${wide ? 'w-20' : 'w-12'}`}>
        <Thumb src={result.thumbnailUrl} fallback={ytFallback(result.videoId)} className="h-full w-full" />
        <span className={`absolute inset-0 flex items-center justify-center bg-black/60 ${busy ? '' : 'opacity-0 group-hover:opacity-100'}`}>
          {busy ? <span className="text-xs font-bold tabular-nums">{Math.round(percent)}%</span> : <Icon name="play_arrow" fill />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{result.title}</p>
        <p className="truncate text-sm text-muted">
          {subtitleOf(result)}
          {busy ? ` • ${status ?? 'queued'}` : mediaId ? ' • In library' : ''}
        </p>
        {busy && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <Menu label={`Actions for ${result.title}`} items={items} trigger={(props) => <IconButton {...props} icon="more_vert" label="More actions" className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" />} />
      {saving && mediaId && <SaveToPlaylistDialog mediaId={mediaId} onClose={() => setSaving(false)} />}
    </div>
  );
}

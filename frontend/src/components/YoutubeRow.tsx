import { useEffect, useState } from 'react';
import { toast } from '../lib/toast';
import { errorMessage, get } from '../lib/api';
import { formatTime } from '../lib/format';
import { useTaskProgress } from '../lib/progress';
import { useCreateDownload } from '../lib/queries';
import type { Task, Track, YoutubeResult } from '../lib/types';
import { playTracks } from '../store/player';
import { useAppDispatch } from '../store';
import { Icon, IconButton, Thumb } from './ui';

export const ytFallback = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
export const subtitleOf = (r: YoutubeResult) =>
  [r.type === 'video' ? 'Video' : 'Song', r.artists?.length ? r.artists.join(', ') : r.channel, r.views && `${r.views} ${r.type === 'video' ? 'views' : 'plays'}`, r.durationSec && formatTime(r.durationSec)]
    .filter(Boolean)
    .join(' • ');

export function usePlayResult(result: YoutubeResult) {
  const dispatch = useAppDispatch();
  const download = useCreateDownload();
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = useTaskProgress(taskId ? [taskId] : [])[taskId ?? ''];
  const playMedia = (mediaId: string) => get<Track>(`/media/${mediaId}`).then((t) => dispatch(playTracks({ tracks: [t] })));

  useEffect(() => {
    if (!taskId || !progress) return;
    if (progress.status === 'completed') {
      get<Task>(`/downloads/${taskId}`)
        .then((task) => (task.mediaId ? playMedia(task.mediaId) : undefined))
        .catch((e) => toast(errorMessage(e)))
        .finally(() => setTaskId(null));
    }
    if (progress.status === 'failed' || progress.status === 'cancelled') {
      toast(progress.error ?? 'Download failed');
      setTaskId(null);
    }
  }, [progress, taskId]);

  async function play() {
    try {
      if (result.mediaId) return await playMedia(result.mediaId);
      const response = await download.mutateAsync({ url: result.url });
      if (response.mediaId) return await playMedia(response.mediaId);
      if (response.taskId) setTaskId(response.taskId);
    } catch (e) {
      toast(errorMessage(e, 'Could not start download'));
    }
  }

  return { play, busy: !!taskId || download.isPending, percent: progress?.progress ?? 0, status: progress?.status };
}

export function YoutubeRow({ result }: { result: YoutubeResult }) {
  const { play, busy, percent, status } = usePlayResult(result);
  const wide = result.type === 'video';

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
          {busy ? ` • ${status ?? 'queued'}` : result.downloaded ? ' • In library' : ''}
        </p>
        {busy && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <IconButton icon="open_in_new" label="Open on YouTube" onClick={() => window.open(result.url, '_blank', 'noopener')} className="hidden opacity-0 group-hover:opacity-100 sm:inline-flex" />
    </div>
  );
}

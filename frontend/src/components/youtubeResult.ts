import { useEffect, useState } from 'react';
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

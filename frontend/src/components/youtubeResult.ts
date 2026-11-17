import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../lib/toast';
import { errorMessage, get, send } from '../lib/api';
import { formatTime } from '../lib/format';
import { keys, useCreateDownload } from '../lib/queries';
import type { Track, YoutubeResult } from '../lib/types';
import { ACTIVE_STATUSES, started } from '../store/downloads';
import { addToQueue, playNext, playTracks } from '../store/player';
import { useAppDispatch, useAppSelector } from '../store';

export const ytFallback = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
export const subtitleOf = (r: YoutubeResult) =>
  [r.type === 'video' ? 'Video' : 'Song', r.artists?.length ? r.artists.join(', ') : r.channel, r.views && `${r.views} ${r.type === 'video' ? 'views' : 'plays'}`, r.durationSec && formatTime(r.durationSec)]
    .filter(Boolean)
    .join(' • ');

type Intent = 'play' | 'next' | 'queue' | 'download';

export function usePlayResult(result: YoutubeResult) {
  const dispatch = useAppDispatch();
  const download = useCreateDownload();
  const entry = useAppSelector((s) => s.downloads.byVideo[result.videoId]);
  const [intent, setIntent] = useState<Intent | null>(null);
  const mediaId = result.mediaId ?? (entry?.status === 'completed' ? entry.mediaId : null);
  const active = !!entry && ACTIVE_STATUSES.includes(entry.status);

  const act = async (id: string, next: Intent) => {
    if (next === 'download') return toast(`${result.title} is in your library`);
    const track = await get<Track>(`/media/${id}`);
    if (next === 'play') return dispatch(playTracks({ tracks: [track] }));
    dispatch(next === 'next' ? playNext(track) : addToQueue(track));
    toast(next === 'next' ? 'Song will play next' : 'Song added to queue');
  };

  useEffect(() => {
    if (!intent || !entry || active) return;
    setIntent(null);
    if (entry.status === 'completed' && entry.mediaId) act(entry.mediaId, intent).catch((e) => toast(errorMessage(e)));
    else toast(entry.error ?? 'Download failed');
  }, [entry, intent, active]);

  async function run(next: Intent = 'play') {
    try {
      if (mediaId) return await act(mediaId, next);
      if (active) return setIntent(next);
      const response = await download.mutateAsync({ url: result.url });
      if (response.mediaId) return await act(response.mediaId, next);
      if (response.taskId) {
        dispatch(started({ videoId: result.videoId, taskId: response.taskId }));
        setIntent(next);
        if (next !== 'play') toast(`Downloading ${result.title}`);
      }
    } catch (e) {
      toast(errorMessage(e, 'Could not start download'));
    }
  }

  return {
    play: () => run('play'),
    run,
    mediaId,
    busy: active || download.isPending,
    percent: active ? entry.progress : 0,
    status: active ? entry.status : undefined,
    error: entry?.status === 'failed' ? entry.error : null,
  };
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

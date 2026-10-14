import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Status } from '../components/ui';
import { get } from '../lib/api';
import type { Track } from '../lib/types';
import { playTracks, setNowPlayingOpen } from '../store/player';
import { useAppDispatch } from '../store';

export default function Watch() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const { data, isError } = useQuery({ queryKey: ['media', id], queryFn: () => get<Track>(`/media/${id}`) });

  useEffect(() => {
    if (!data) return;
    dispatch(playTracks({ tracks: [data] }));
    dispatch(setNowPlayingOpen(true));
  }, [data, dispatch]);

  if (isError) return <Status icon="music_off" title="This song isn't available" />;
  if (data) return <Navigate to="/" replace />;
  return <Spinner className="mx-auto mt-20" />;
}

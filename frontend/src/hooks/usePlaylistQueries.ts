import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Playlist, PlaylistDetail } from '../types/playlist';


export const playlistKeys = {
  all:    ['playlists'] as const,
  user:   ()         => [...playlistKeys.all, 'user']     as const,
  detail: (id: string) => [...playlistKeys.all, 'detail', id] as const,
};

export function useUserPlaylists() {
  return useQuery({
    queryKey: playlistKeys.user(),
    queryFn:  async () => {
      const { data } = await api.get('/playlists');
      return (data.playlists ?? []) as Playlist[];
    },
    staleTime: 2 * 60_000,
  });
}

export function usePlaylist(id: string | undefined) {
  return useQuery({
    queryKey: playlistKeys.detail(id!),
    queryFn:  async () => {
      const { data } = await api.get(`/playlists/${id}`);
      return data.playlist as PlaylistDetail;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; isPublic?: boolean }) =>
      api.post('/playlists', payload).then(r => r.data.playlist),
    onSuccess: () => qc.invalidateQueries({ queryKey: playlistKeys.user() }),
  });
}

export function useAddTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, mediaId }: { playlistId: string; mediaId: string }) =>
      api.post(`/playlists/${playlistId}/tracks`, { mediaId }),
    onSuccess: (_, { playlistId }) => {
      qc.invalidateQueries({ queryKey: playlistKeys.detail(playlistId) });
      qc.invalidateQueries({ queryKey: playlistKeys.user() });
    },
  });
}

export function useRemoveTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, mediaId }: { playlistId: string; mediaId: string }) =>
      api.delete(`/playlists/${playlistId}/tracks/${mediaId}`),
    onSuccess: (_, { playlistId }) => {
      qc.invalidateQueries({ queryKey: playlistKeys.detail(playlistId) });
      qc.invalidateQueries({ queryKey: playlistKeys.user() });
    },
  });
}
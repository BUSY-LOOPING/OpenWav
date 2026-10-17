import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, get, getPage, send } from './api';
import { track } from './events';
import { toast } from './toast';
import { playTracks, setLiked } from '../store/player';
import { useAppDispatch } from '../store';
import type {
  DiscoveryStatus,
  AdminHealth,
  AdminUser,
  Album,
  AlbumDetail,
  Alert,
  Artist,
  ArtistDetail,
  DownloadResponse,
  Explore,
  HistoryTrack,
  Lyrics,
  Playlist,
  OnlinePlaylistDetail,
  PlaylistDetail,
  RecommenderInsights,
  RelatedResults,
  SearchResults,
  SearchScope,
  SearchType,
  Section,
  Settings,
  Task,
  Track,
  User,
} from './types';

export const keys = {
  home: ['home'],
  explore: ['explore'],
  mood: (mood: string) => ['mood', mood],
  media: (id: string) => ['media', id],
  related: (id: string) => ['related', id],
  lyrics: (id: string) => ['lyrics', id],
  artist: (id: string) => ['artist', id],
  album: (id: string) => ['album', id],
  playlist: (id: string) => ['playlist', id],
  search: (q: string, scope: SearchScope, type: SearchType) => ['search', q, scope, type],
  suggestions: (q: string) => ['suggestions', q],
  library: (kind: string) => ['library', kind],
  myPlaylists: ['library', 'playlists'],
  preferences: ['preferences'],
  downloads: ['downloads'],
  admin: (...parts: unknown[]) => ['admin', ...parts],
};

export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => get<Section[]>('/home') });
export const useExplore = () => useQuery({ queryKey: keys.explore, queryFn: () => get<Explore>('/explore') });
export const useMood = (mood: string) =>
  useQuery({ queryKey: keys.mood(mood), queryFn: () => get<Track[]>(`/explore/moods/${encodeURIComponent(mood)}`) });
export const useRelated = (id: string | undefined) =>
  useQuery({ queryKey: keys.related(id ?? ''), queryFn: () => get<RelatedResults>(`/media/${id}/related`), enabled: !!id, staleTime: 10 * 60_000 });
export const useLyrics = (id: string | undefined) =>
  useQuery({ queryKey: keys.lyrics(id ?? ''), queryFn: () => get<Lyrics>(`/media/${id}/lyrics`), enabled: !!id, retry: false });
export const useArtist = (id: string) => useQuery({ queryKey: keys.artist(id), queryFn: () => get<ArtistDetail>(`/artists/${id}`) });
export const useAlbum = (id: string) => useQuery({ queryKey: keys.album(id), queryFn: () => get<AlbumDetail>(`/albums/${id}`) });
export const usePlaylist = (id: string) =>
  useQuery({ queryKey: keys.playlist(id), queryFn: () => get<PlaylistDetail>(`/playlists/${id}`), refetchInterval: (q) => (q.state.data?.import ? 4000 : false) });
export const useMyPlaylists = (enabled = true) =>
  useQuery({ queryKey: keys.myPlaylists, queryFn: () => get<Playlist[]>('/library/playlists'), enabled });
export const useLibraryArtists = () => useQuery({ queryKey: keys.library('artists'), queryFn: () => get<Artist[]>('/library/artists') });
export const useLibraryAlbums = () => useQuery({ queryKey: keys.library('albums'), queryFn: () => get<Album[]>('/library/albums') });
export const usePreferences = () => useQuery({ queryKey: keys.preferences, queryFn: () => get<Record<string, unknown>>('/me/preferences') });

export function usePaged<T>(key: unknown[], url: string, params: Record<string, unknown> = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...key, params],
    queryFn: ({ pageParam }) => getPage<T>(url, { ...params, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export const useOnlinePlaylist = (id: string, enabled = true) =>
  useQuery({ queryKey: ['online-playlist', id], queryFn: () => get<OnlinePlaylistDetail>(`/search/playlist/${id}`), staleTime: 5 * 60_000, enabled: enabled && !!id });

export function usePlayCollection() {
  const dispatch = useAppDispatch();
  return async (load: () => Promise<Track[]>) => {
    try {
      const tracks = await load();
      if (!tracks.length) return toast('Nothing to play yet');
      dispatch(playTracks({ tracks }));
    } catch (e) {
      toast(errorMessage(e, 'Could not play'));
    }
  };
}
export const loadPlaylistTracks = (id: string) => () => get<PlaylistDetail>(`/playlists/${id}`).then((p) => p.tracks);
export const loadLikedTracks = () => getPage<Track>('/library/liked', { limit: 100 }).then((p) => p.data);

export const useLiked = () => usePaged<Track>(keys.library('liked'), '/library/liked');
export const useHistory = () => usePaged<HistoryTrack>(keys.library('history'), '/library/history');

export const useSearch = (q: string, scope: SearchScope, type: SearchType) =>
  useQuery({ queryKey: keys.search(q, scope, type), queryFn: () => get<SearchResults>('/search', { q, scope, type }), enabled: q.trim().length > 0, staleTime: 5 * 60_000 });
export const useSuggestions = (q: string) =>
  useQuery({
    queryKey: keys.suggestions(q),
    queryFn: () => get<string[]>('/search/suggestions', { q }),
    enabled: q.trim().length > 1,
    staleTime: 60_000,
  });

export function useToggleLike() {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      send<{ liked: boolean }>(liked ? 'put' : 'delete', `/media/${id}/like`),
    onMutate: ({ id, liked }) => {
      dispatch(setLiked({ id, liked }));
      track({ type: liked ? 'like' : 'unlike', mediaId: id });
    },
    onError: (_e, { id, liked }) => dispatch(setLiked({ id, liked: !liked })),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.library('liked') });
      qc.invalidateQueries({ queryKey: ['playlist'] });
      qc.invalidateQueries({ queryKey: ['album'] });
      qc.invalidateQueries({ queryKey: keys.home });
    },
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; isPublic?: boolean }) => send<Playlist>('post', '/playlists', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myPlaylists }),
  });
}

export function useImportPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; name?: string; isPublic?: boolean }) =>
      send<{ playlistId: string; playlistTaskId: string }>('post', '/playlists/import', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myPlaylists }),
  });
}

export function usePlaylistMutations(id: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.playlist(id) });
    qc.invalidateQueries({ queryKey: keys.myPlaylists });
  };
  return {
    update: useMutation({
      mutationFn: (body: Partial<Pick<Playlist, 'name' | 'description' | 'isPublic'>>) => send<Playlist>('patch', `/playlists/${id}`, body),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: () => send('delete', `/playlists/${id}`), onSuccess: refresh }),
    removeTrack: useMutation({
      mutationFn: (mediaId: string) => send('delete', `/playlists/${id}/tracks/${mediaId}`),
      onSuccess: (_d, mediaId) => {
        track({ type: 'remove_from_playlist', mediaId, playlistId: id });
        refresh();
      },
    }),
    reorder: useMutation({ mutationFn: (mediaIds: string[]) => send('put', `/playlists/${id}/order`, { mediaIds }), onSettled: refresh }),
    save: useMutation({
      mutationFn: (saved: boolean) => send<{ saved: boolean }>(saved ? 'put' : 'delete', `/playlists/${id}/save`),
      onSuccess: refresh,
    }),
  };
}

export function useAddToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, mediaId }: { playlistId: string; mediaId: string }) =>
      send('post', `/playlists/${playlistId}/tracks`, { mediaId }),
    onSuccess: (_d, { playlistId, mediaId }) => {
      track({ type: 'add_to_playlist', mediaId, playlistId });
      qc.invalidateQueries({ queryKey: keys.playlist(playlistId) });
      qc.invalidateQueries({ queryKey: keys.myPlaylists });
    },
  });
}

export function useSubscribe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribed: boolean) => send<{ subscribed: boolean }>(subscribed ? 'put' : 'delete', `/artists/${id}/subscription`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.artist(id) });
      qc.invalidateQueries({ queryKey: keys.library('artists') });
    },
  });
}

export function useCreateDownload() {
  return useMutation({
    mutationFn: (body: { url: string; format?: string; quality?: string; playlistId?: string }) => {
      track({ type: 'download_request' });
      return send<DownloadResponse>('post', '/downloads', body);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username?: string; currentPassword?: string; newPassword?: string }) => send<User>('patch', '/auth/me', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => send<Record<string, unknown>>('patch', '/me/preferences', body),
    onSuccess: (data) => qc.setQueryData(keys.preferences, data),
  });
}

export const useAdminStats = () =>
  useQuery({ queryKey: keys.admin('stats'), queryFn: () => get<Record<string, Record<string, number>>>('/admin/stats'), refetchInterval: 30_000 });
export const useAdminHealth = () =>
  useQuery({ queryKey: keys.admin('health'), queryFn: () => get<AdminHealth>('/admin/health'), refetchInterval: 15_000 });
export const useAdminAlerts = () => useQuery({ queryKey: keys.admin('alerts'), queryFn: () => get<Alert[]>('/admin/alerts'), refetchInterval: 30_000 });
export const useAdminSettings = () => useQuery({ queryKey: keys.admin('settings'), queryFn: () => get<Settings>('/admin/settings') });
export const useAdminUsers = (params: Record<string, unknown>) => usePaged<AdminUser>(keys.admin('users'), '/admin/users', params);
export const useAdminDownloads = (params: Record<string, unknown>) =>
  usePaged<Task>(keys.admin('downloads'), '/admin/downloads', params);
export const useAdminDiscovery = () =>
  useQuery({
    queryKey: keys.admin('discovery'),
    queryFn: () => get<DiscoveryStatus>('/admin/discovery'),
    refetchInterval: (q) => (q.state.data && !q.state.data.lastRun?.finishedAt) || q.state.data?.counts.queued || q.state.data?.counts.downloading || q.state.data?.counts.uploading ? 3000 : 30_000,
  });
export const useAdminRecommender = () =>
  useQuery({
    queryKey: keys.admin('recommender'),
    queryFn: () => get<RecommenderInsights>('/admin/recommender'),
    refetchInterval: (q) => (['loading', 'training'].includes(q.state.data?.status.state ?? '') ? 1500 : 15_000),
  });
export const useAdminCookies = () =>
  useQuery({ queryKey: keys.admin('cookies'), queryFn: () => get<{ configured: boolean; entries: number; domains: string[]; expiresAt: string | null; updatedAt: string | null }>('/admin/ytdlp/cookies') });
export const useAdminMedia = (params: Record<string, unknown>) => usePaged<Track>(keys.admin('media'), '/admin/media', params);

export function useAdminAction(scope: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, url, body }: { method: 'post' | 'patch' | 'put' | 'delete'; url: string; body?: unknown }) => send<unknown>(method, url, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.admin(scope) }),
  });
}

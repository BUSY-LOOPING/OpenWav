import { useEffect } from 'react';
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
  LogLine,
  Lyrics,
  Playlist,
  OnlinePlaylistDetail,
  OnlinePlaylistTrack,
  PlaylistDetail,
  PlaylistItem,
  RecommenderInsights,
  RelatedResults,
  SearchResults,
  SearchScope,
  SearchType,
  Section,
  ServerMetrics,
  Settings,
  Task,
  TraceSummary,
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
const IMPORT_POLL_MS = 4000;
export const usePlaylist = (id: string) =>
  useQuery({ queryKey: keys.playlist(id), queryFn: () => get<PlaylistDetail>(`/playlists/${id}`), refetchInterval: (q) => (q.state.data?.import?.running ? IMPORT_POLL_MS : false) });
export const usePlaylistItems = (id: string, importing: boolean) => {
  const query = usePaged<PlaylistItem>([...keys.playlist(id), 'items'], `/playlists/${id}/items`, { limit: 50 });
  const { refetch } = query;
  useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => refetch(), IMPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [importing, refetch]);
  return query;
};
export const useMyPlaylists = (enabled = true) => usePaged<Playlist>(keys.myPlaylists, '/library/playlists', { limit: 50 }, enabled);
export const useLibraryArtists = () => usePaged<Artist>(keys.library('artists'), '/library/artists', { limit: 48 });
export const useLibraryAlbums = () => usePaged<Album>(keys.library('albums'), '/library/albums', { limit: 48 });
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

export const useOnlinePlaylist = (id: string) =>
  useQuery({ queryKey: ['online-playlist', id], queryFn: () => get<OnlinePlaylistDetail>(`/search/playlist/${id}`), staleTime: 5 * 60_000, enabled: !!id });
export const useOnlinePlaylistTracks = (id: string) => usePaged<OnlinePlaylistTrack>(['online-playlist', id, 'tracks'], `/search/playlist/${id}/tracks`, { limit: 50 }, !!id);

export async function loadAll<T>(url: string, params: Record<string, unknown> = {}) {
  const items: T[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await getPage<T>(url, { ...params, limit: 100, cursor: cursor || undefined });
    items.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export const flat = <T,>(query: { data?: { pages: { data: T[] }[] } }) => query.data?.pages.flatMap((p) => p.data) ?? [];

export function usePlayCollection() {
  const dispatch = useAppDispatch();
  return async (load: () => Promise<Track[]>, shuffle = false) => {
    try {
      const tracks = await load();
      if (!tracks.length) return toast('Nothing to play yet');
      dispatch(playTracks({ tracks, shuffle }));
    } catch (e) {
      toast(errorMessage(e, 'Could not play'));
    }
  };
}
export const loadPlaylistTracks = (id: string) => () => loadAll<PlaylistItem>(`/playlists/${id}/items`).then((items) => items.flatMap((i) => (i.track ? [i.track] : [])));
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
    move: useMutation({ mutationFn: ({ mediaId, position }: { mediaId: string; position: number }) => send('put', `/playlists/${id}/tracks/${mediaId}/position`, { position }), onSettled: refresh }),
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
export const useAdminServer = () => useQuery({ queryKey: keys.admin('server'), queryFn: () => get<ServerMetrics>('/admin/server'), refetchInterval: 15_000, retry: false });
export const useAdminTraces = (params: Record<string, unknown>, live: boolean) =>
  useQuery({ queryKey: keys.admin('traces', params), queryFn: () => get<TraceSummary[]>('/admin/traces', params), refetchInterval: live ? 5000 : false, retry: false });
export const useAdminLogs = (params: Record<string, unknown>, live: boolean) =>
  useQuery({ queryKey: keys.admin('logs', params), queryFn: () => get<LogLine[]>('/admin/logs', params), refetchInterval: live ? 3000 : false, retry: false });
export const useAdminMedia = (params: Record<string, unknown>) => usePaged<Track>(keys.admin('media'), '/admin/media', params);

export function useAdminAction(scope: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, url, body }: { method: 'post' | 'patch' | 'put' | 'delete'; url: string; body?: unknown }) => send<unknown>(method, url, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.admin(scope) }),
  });
}

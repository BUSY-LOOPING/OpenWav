import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchHomeSections,
  fetchMediaList,
  fetchMediaDetails,
  fetchWatchHistory,
  fetchSearchResults,
  updateWatchProgress,
  toggleLike,
  type GetMediaParams,
} from '../services/mediaService';

export const mediaKeys = {
  all:      ['media'] as const,
  home:     ()                    => [...mediaKeys.all, 'home']                       as const,
  list:     (params: GetMediaParams) => [...mediaKeys.all, 'list', JSON.stringify(params)] as const,
  detail:   (id: string)          => [...mediaKeys.all, 'detail', id]                 as const,
  history:  (params: object)      => [...mediaKeys.all, 'history', JSON.stringify(params)] as const,
  search:   (q: string)           => [...mediaKeys.all, 'search', q]                  as const,
};

export function useHomeSections() {
  return useQuery({
    queryKey: mediaKeys.home(),
    queryFn:  fetchHomeSections,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  });
}

export function useMediaList(params: GetMediaParams = {}) {
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn:  () => fetchMediaList(params),
    staleTime: 2 * 60_000,
  });
}

export function useMediaDetails(id: string) {
  return useQuery({
    queryKey: mediaKeys.detail(id),
    queryFn:  () => fetchMediaDetails(id),
    staleTime: 5 * 60_000,
    enabled:  !!id,
  });
}

export function useWatchHistory(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: mediaKeys.history(params),
    queryFn:  () => fetchWatchHistory(params),
    staleTime: 60_000,
  });
}

export function useSearchResults(q: string, enabled = true) {
  return useQuery({
    queryKey: mediaKeys.search(q),
    queryFn:  () => fetchSearchResults(q),
    staleTime: 2 * 60_000,
    enabled:  !!q && q.length >= 2 && enabled,
  });
}

export function useUpdateProgress() {
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; watchTime: number; currentTime: number; completed: boolean }) =>
      updateWatchProgress(id, payload),
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleLike(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: mediaKeys.detail(id) });
      qc.invalidateQueries({ queryKey: mediaKeys.home() });
    },
  });
}
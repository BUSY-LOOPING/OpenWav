import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  fetchDashboardStats,
  fetchUsers,
  fetchDownloadTasks,
  fetchGlobalSettings,
  updateUser,
  deleteUser,
  cancelDownloadTask,
  updateGlobalSetting,
  updateConcurrentDownloads,
  type GetUsersParams,
  type GetDownloadTasksParams,
  type UpdateUserPayload,
  type UpdateSettingPayload,
} from '../services/adminService';

export const adminKeys = {
  all:       ['admin'] as const,
  stats:     ()                              => [...adminKeys.all, 'stats']               as const,
  users:     (params: GetUsersParams)        => [...adminKeys.all, 'users', params]        as const,
  downloads: (params: GetDownloadTasksParams)=> [...adminKeys.all, 'downloads', params]    as const,
  settings:  ()                              => [...adminKeys.all, 'settings']             as const,
};

const NO_CACHE = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: true,
} as const;

export function useDashboardStats() {
  return useQuery({
    queryKey:       adminKeys.stats(),
    queryFn:        fetchDashboardStats,
    staleTime:      30_000,
    refetchInterval: 60_000,
  });
}

export function useAdminUsers(params: GetUsersParams = {}) {
  return useQuery({
    queryKey:        adminKeys.users(params),
    queryFn:         () => fetchUsers(params),
    placeholderData: keepPreviousData,
    staleTime:       15_000,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useAdminDownloads(params: GetDownloadTasksParams = {}) {
    console.log('params', params)
  return useQuery({
    queryKey:        adminKeys.downloads(params),
    queryFn:         () => fetchDownloadTasks(params),
    placeholderData: keepPreviousData,
    staleTime:       10_000,
    refetchInterval: 15_000,
  });
}

export function useCancelDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelDownloadTask(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'downloads'] }),
  });
}

export function useGlobalSettings() {
  return useQuery({
    queryKey:  adminKeys.settings(),
    queryFn:   fetchGlobalSettings,
    staleTime: 60_000,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: UpdateSettingPayload }) =>
      updateGlobalSetting(key, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.settings() }),
  });
}

export function useUpdateConcurrentDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => updateConcurrentDownloads(count),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.settings() });
      qc.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}
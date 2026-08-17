import api from './api';
import type { ApiResponse } from '../types/api';
import type {
  DashboardStats,
  User,
  DownloadTask,
  GlobalSetting,
  GetUsersParams,
  GetDownloadTasksParams,
  UpdateUserPayload,
  UpdateSettingPayload,
  UsersResult,
  DownloadTasksResult,
  SettingResult,
} from '../types/admin';

const BASE = '/admin';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<ApiResponse<DashboardStats>>(`${BASE}/stats`);
  return data.data;
}

export async function fetchUsers(
  params: GetUsersParams = {}
): Promise<UsersResult> {
  const { data } = await api.get<ApiResponse<UsersResult>>(
    `${BASE}/users`,
    { params }
  );
  return data.data;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload
): Promise<{ user: User }> {
  const { data } = await api.put<ApiResponse<{ user: User }>>(
    `${BASE}/users/${id}`,
    payload
  );
  return data.data;
}

export async function deleteUser(
  id: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete<ApiResponse<never>>(`${BASE}/users/${id}`);
  return { success: data.success, message: data.message ?? '' };
}

export async function fetchDownloadTasks(
  params: GetDownloadTasksParams = {}
): Promise<DownloadTasksResult> {
  const { data } = await api.get<ApiResponse<DownloadTasksResult>>(
    `${BASE}/downloads`,
    { params }
  );
  return data.data;
}

export async function cancelDownloadTask(
  id: string
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.patch<ApiResponse<never>>(
    `${BASE}/downloads/${id}/cancel`
  );
  return { success: data.success, message: data.message ?? '' };
}


export async function updateGlobalSetting(
  key: string,
  payload: UpdateSettingPayload
): Promise<SettingResult> {
  const { data } = await api.put<ApiResponse<SettingResult>>(
    `${BASE}/settings/${key}`,
    payload
  );
  return data.data;
}
export async function fetchGlobalSettings(): Promise<Record<string, GlobalSetting>> {
  const { data } = await api.get<ApiResponse<{ settings: Record<string, GlobalSetting> }>>(
    `${BASE}/settings`
  );
  return data.data.settings;
}
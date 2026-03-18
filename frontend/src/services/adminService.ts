import api from './api';

const BASE = '/admin';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface GetUsersParams extends PaginationParams {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive';
}

export interface GetDownloadTasksParams extends PaginationParams {
  status?: string;
  userId?: string;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export interface UpdateSettingPayload {
  value: string | number | boolean | object;
  dataType?: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  isPublic?: boolean;
}

export async function fetchDashboardStats() {
  const { data } = await api.get(`${BASE}/stats`);
  return data.data;
}

export async function fetchUsers(params: GetUsersParams = {}) {
    console.log(`fetchUsers url - ${BASE}/users`)
  const { data } = await api.get(`${BASE}/users`, { params });
  console.log('fetchUsers data', data)
  return data.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const { data } = await api.put(`${BASE}/users/${id}`, payload);
  return data.data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete(`${BASE}/users/${id}`);
  return data;
}

export async function fetchDownloadTasks(params: GetDownloadTasksParams = {}) {
  const { data } = await api.get(`${BASE}/downloads`, { params });
  return data.data;
}

export async function cancelDownloadTask(id: string) {
  const { data } = await api.post(`${BASE}/downloads/${id}/cancel`);
  return data;
}

export async function fetchGlobalSettings() {
  const { data } = await api.get(`${BASE}/settings`);
  return data.data.settings;
}

export async function updateGlobalSetting(key: string, payload: UpdateSettingPayload) {
  const { data } = await api.put(`${BASE}/settings/${key}`, payload);
  return data.data;
}

export async function updateConcurrentDownloads(count: number) {
  const { data } = await api.put(`${BASE}/settings/concurrent-downloads`, { count });
  return data.data;
}
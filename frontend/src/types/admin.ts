// src/types/admin.ts
import type { CursorPagination } from './api';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user';

export type UserStatus = 'active' | 'inactive';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SettingDataType = 'string' | 'number' | 'boolean' | 'json';

export type MediaStatus =
  | 'pending'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'deleted';

const STATUS_MAP: Record<string, DownloadStatus[]> = {
  Queue:   ['queued', 'downloading'],
  History: ['completed'],
  Failed:  ['failed'],
};

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface UserStats {
  mediaCount: number;
  downloadCount: number;
  storageUsed: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLogin: string | null;
  lastSeen: string | null;
  createdAt: string;
  stats: UserStats;
}

export interface DownloadTask {
  id: string;
  url: string;
  status: DownloadStatus;
  progress: number | null;
  quality: string;
  format: string;
  errorMessage: string | null;
  retryCount: number;
  mediaId: string | null;
  mediaTitle: string | null;
  username: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface GlobalSetting {
  value: string | number | boolean | object;
  dataType: SettingDataType;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface UserDashboardStats {
  total: number;
  admins: number;
  users: number;
  active: number;
  newThisWeek: number;
  activeToday: number;
  onlineNow: number;
  activeRecently: number;
}

export interface MediaDashboardStats {
  total: number;
  completed: number;
  failed: number;
  newThisWeek: number;
  totalSize: number;
  avgDuration: number;
}

export interface DownloadDashboardStats {
  total: number;
  queued: number;
  downloading: number;
  completed: number;
  failed: number;
  today: number;
}

export interface StorageDashboardStats {
  mediaSize: number;
  tempSize: number;
  totalSize: number;
}

export interface DashboardStats {
  users: UserDashboardStats;
  media: MediaDashboardStats;
  downloads: DownloadDashboardStats;
  storage: StorageDashboardStats;
  lastUpdated: string;
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface GetUsersParams {
  limit?: number;
  cursor?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface GetDownloadTasksParams {
  limit?: number;
  cursor?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: DownloadStatus;
  userId?: string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateSettingPayload {
  value: string | number | boolean | object;
  dataType?: SettingDataType;
  description?: string;
  isPublic?: boolean;
}

// ─── Service return shapes ────────────────────────────────────────────────────

export interface UsersResult {
  users: User[];
  pagination: CursorPagination;
}

export interface DownloadTasksResult {
  tasks: DownloadTask[];
  pagination: CursorPagination;
}

export interface SettingResult {
  setting: GlobalSetting;
}
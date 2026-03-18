import api from './api';

export type TileType = 'standard' | 'circle' | 'mosaic' | 'wide';
export type TileSize = 'normal' | 'large';

export interface Tile {
  id: string;
  tileType: TileType;
  size?: TileSize;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  images?: string[];
  href: string;
  resumePosition?: number;
}

export interface HomeSection {
  type: string;
  title: string;
  subtitle?: string | null;
  avatar?: boolean;
  tiles: Tile[];
}

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  format: string;
  quality: string;
  platform: string;
  thumbnailPath?: string;
  fileSize?: number;
  likesCount: number;
  userLiked: boolean;
  uploaderUsername?: string;
  createdAt: string;
  metadata?: Record<string, any>;
  watchProgress?: {
    watchTime: number;
    lastPosition: number;
    completed: boolean;
  } | null;
}

export interface GetMediaParams {
  page?: number;
  limit?: number;
  platform?: string;
  format?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchHomeSections(): Promise<HomeSection[]> {
  const { data } = await api.get('/media/home/sections');
  if (!data?.data) throw new Error('Invalid response from /media/home/sections');
  return data.data.sections;
}

export async function fetchMediaList(params: GetMediaParams = {}) {
  const { data } = await api.get('/media', { params });
  if (!data?.data) throw new Error('Invalid response from /media');
  return data.data;
}

export async function fetchMediaDetails(id: string) {
  const { data } = await api.get(`/media/${id}`);
  if (!data?.data) throw new Error('Invalid response from /media/:id');
  return data.data.media as MediaItem;
}

export async function updateWatchProgress(id: string, payload: {
  watchTime: number;
  currentTime: number;
  completed: boolean;
}) {
  const { data } = await api.patch(`/media/${id}/progress`, payload);
  return data;
}

export async function toggleLike(id: string) {
  const { data } = await api.post(`/media/${id}/like`);
  return data.data as { liked: boolean; likesCount: number };
}

export async function fetchWatchHistory(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get('/media/user/history', { params });
  if (!data?.data) throw new Error('Invalid response from /media/user/history');
  return data.data;
}

export async function fetchSearchResults(q: string, params: {
  limit?: number;
  includeYoutube?: boolean;
} = {}) {
  const { data } = await api.get('/media/search', { params: { q, ...params } });
  if (!data?.data) throw new Error('Invalid response from /media/search');
  return data.data;
}
import api from './api';

export interface CreateDownloadPayload {
  url: string;
  format: string;
  quality: string;
}

export interface CreateDownloadResponse {
  type: 'track' | 'playlist';
  taskId?: string;      
  playlistId?: string; 
  message: string;
}

export interface DownloadTask {
  id: string;
  url: string;
  format: string;
  quality: string;
  status: string;
  progress: number | null;
  retryCount: number;
  createdAt: string;
  mediaTitle: string | null;
  username: string | null;
}

export async function createDownload(payload: CreateDownloadPayload): Promise<CreateDownloadResponse> {
  const res = await api.post<CreateDownloadResponse>('/downloads', payload);
  return res.data;
}
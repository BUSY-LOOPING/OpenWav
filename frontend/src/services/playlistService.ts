import api from './api';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  collaborate: boolean;
  owner: string;
  ownerUsername: string;
  isPinned?: boolean;
  isAuto?: boolean;
  trackCount: number;
  totalDuration: number;
  createdAt: string;
}

export interface CreatePlaylistPayload {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get('/playlists');
  if (!data?.playlists) throw new Error('Invalid response');
  console.log('playlist data',data)
  return data.playlists;
}

export async function createPlaylist(payload: CreatePlaylistPayload): Promise<Playlist> {
  const { data } = await api.post('/playlists', payload);
  if (!data?.playlist) throw new Error('Invalid response');
  return data.playlist;
}

export async function fetchPlaylistById(id: string): Promise<Playlist & { tracks: any[] }> {
  const { data } = await api.get(`/playlists/${id}`);
  if (!data?.playlist) throw new Error('Invalid response');
  return { ...data.playlist, tracks: data.playlist.tracks ?? [] };
}

export async function addTrackToPlaylist(playlistId: string, mediaId: string): Promise<void> {
  await api.post(`/playlists/${playlistId}/tracks`, { mediaId });
}

export async function removeTrackFromPlaylist(playlistId: string, mediaId: string): Promise<void> {
  await api.delete(`/playlists/${playlistId}/tracks/${mediaId}`);
}
import type { MediaListResponse } from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  async getMediaList(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<MediaListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.search) searchParams.append("search", params.search);
    
    const queryString = searchParams.toString();
    const endpoint = `/media${queryString ? `?${queryString}` : ""}`;
    
    return this.request<MediaListResponse>(endpoint);
  }

  async getMediaDetails(id: string): Promise<any> {
    return this.request(`/media/${id}`);
  }

  async toggleLike(id: string, token: string): Promise<any> {
    return this.request(`/media/${id}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

export const apiService = new ApiService();

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  duration: number;
  format: string;
  quality: string;
  platform: string;
  thumbnailPath: string;
  fileSize: string;
  likesCount: number;
  userLiked: boolean;
  uploaderUsername: string;
  createdAt: string;
  metadata: {
    tags: string[];
    extractor: string;
    categories: string[];
    webpage_url: string;
  };
}

export interface MediaListResponse {
  success: boolean;
  data: {
    media: MediaItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

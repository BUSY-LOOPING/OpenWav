// types/ytdlp.ts

export interface YtdlpThumbnail {
    url: string;
    width?: number;
    height?: number;
    preference?: number;
    id?: string;
    resolution?: string;
}

export interface YtdlpRawMetadata {
    id: string;
    title?: string;
    fulltitle?: string;
    description?: string;
    duration?: number;
    thumbnail?: string;
    thumbnails?: YtdlpThumbnail[];
    webpage_url?: string;
    original_url?: string;
    uploader?: string;
    uploader_url?: string;
    channel?: string;
    channel_url?: string;
    channel_id?: string;
    upload_date?: string;          // yyyymmdd format
    tags?: string[];
    categories?: string[];
    language?: string | null;
    age_limit?: number;
    extractor?: string;
    extractor_key?: string;
    playlist?: string | null;
    playlist_id?: string | null;
    // music-specific (present in your sample output)
    artists?: string[];
    album?: string;
    track?: string;
    release_date?: string;
    release_year?: number;
    like_count?: number;
    view_count?: number;
    comment_count?: number;
}

// What parseYtdlpMetadata returns — used throughout your app
export interface ParsedMetadata {
    title: string;
    description: string | null;
    duration: number | null;
    thumbnailUrl: string | null;
    platform: 'youtube' | 'soundcloud' | 'vimeo' | 'unknown';
    uploader: string | null;
    uploaderUrl: string | null;
    uploadDate: string | null;  
    tags: string[];
    categories: string[];
    language: string | null;
    ageLimit: number;
    webpage_url: string | null;
    extractor: string | null;
    raw: {
        id: string | undefined;
        extractor: string | undefined;
        extractor_key: string | undefined;
        channel_id: string | undefined;
        playlist: string | null | undefined;
        playlist_id: string | null | undefined;
    };
    viewCount: number | null;
    likeCount: number | null;
}

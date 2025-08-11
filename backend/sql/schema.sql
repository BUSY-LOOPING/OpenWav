
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User settings table (key-value pairs for flexible settings)
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

-- Global settings table (admin-configurable settings)
CREATE TABLE global_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Whether users can see this setting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Media table (stores information about downloaded media)
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    url VARCHAR(1000) NOT NULL, -- Original URL
    platform VARCHAR(50), -- youtube, vimeo, etc.
    duration INTEGER, -- Duration in seconds
    file_path VARCHAR(1000), -- Path to the media file
    thumbnail_path VARCHAR(1000), -- Path to thumbnail/cover
    file_size BIGINT, -- File size in bytes
    format VARCHAR(50), -- mp4, mp3, etc.
    quality VARCHAR(20), -- 1080p, 720p, 192k, etc.
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'completed', 'failed', 'deleted')),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB, -- Additional metadata from yt-dlp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User history (tracks what users have played and for how long)
CREATE TABLE user_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    watch_time INTEGER DEFAULT 0, -- Time watched in seconds
    total_duration INTEGER, -- Total duration when played
    completed BOOLEAN DEFAULT false, -- Whether user finished the media
    last_position INTEGER DEFAULT 0, -- Last playback position in seconds
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, media_id)
);

-- Download tasks table (for managing concurrent downloads)
CREATE TABLE download_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(1000) NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'downloading', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0, -- Progress percentage (0-100)
    quality VARCHAR(20), -- Requested quality
    format VARCHAR(20), -- Requested format
    error_message TEXT,
    media_id UUID REFERENCES media(id) ON DELETE SET NULL, -- Linked media when completed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    priority INTEGER DEFAULT 5, -- Lower number = higher priority
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table (for JWT refresh token management)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);


-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_key ON user_settings(setting_key);
CREATE INDEX idx_global_settings_key ON global_settings(setting_key);
CREATE INDEX idx_media_status ON media(status);
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX idx_media_platform ON media(platform);
CREATE INDEX idx_media_created_at ON media(created_at DESC);
CREATE INDEX idx_user_history_user_id ON user_history(user_id);
CREATE INDEX idx_user_history_media_id ON user_history(media_id);
CREATE INDEX idx_user_history_played_at ON user_history(played_at DESC);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_media_id ON likes(media_id);
CREATE INDEX idx_download_tasks_status ON download_tasks(status);
CREATE INDEX idx_download_tasks_priority ON download_tasks(priority);
CREATE INDEX idx_download_tasks_created_at ON download_tasks(created_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON global_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_updated_at BEFORE UPDATE ON media
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_history_updated_at BEFORE UPDATE ON user_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_download_tasks_updated_at BEFORE UPDATE ON download_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default global settings
INSERT INTO global_settings (setting_key, setting_value, data_type, description, is_public) VALUES
('max_concurrent_downloads', '3', 'number', 'Maximum number of concurrent downloads', false),
('default_video_quality', '720p', 'string', 'Default video quality for downloads', true),
('default_audio_quality', '192k', 'string', 'Default audio quality for downloads', true),
('max_file_size_mb', '500', 'number', 'Maximum file size for downloads in MB', true),
('allowed_domains', '["youtube.com", "youtu.be", "vimeo.com", "soundcloud.com"]', 'json', 'Allowed domains for downloads', false),
('registration_enabled', 'true', 'boolean', 'Whether new user registration is enabled', false),
('require_email_verification', 'false', 'boolean', 'Whether email verification is required', false),
('max_downloads_per_user_per_day', '100', 'number', 'Maximum downloads per user per day', true),
('cleanup_failed_downloads_after_hours', '24', 'number', 'Clean up failed downloads after N hours', false),
('app_name', 'Media Streaming App', 'string', 'Application name', true),
('app_description', 'A powerful media streaming application', 'string', 'Application description', true);
-- 2
INSERT INTO global_settings (setting_key, setting_value, data_type, description)
VALUES ('max_auto_downloads', '10', 'number', 'Maximum number of videos to auto-download from a search query')
ON CONFLICT (setting_key) DO NOTHING;
-- 3
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE,
    image_url TEXT,
    genres TEXT[], -- Array of genres
    bio TEXT,
    social_links JSONB, -- {twitter, instagram, spotify, etc.}
    metadata JSONB, -- Additional metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlists table (general purpose)
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    total_tracks INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- in seconds
    metadata JSONB, -- Additional metadata like source, chart_date, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for playlist tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, media_id),
    UNIQUE(playlist_id, position)
);

-- Junction table for media artists
CREATE TABLE IF NOT EXISTS media_artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID REFERENCES media(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'artist', -- 'artist', 'featured', 'producer', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_id, artist_id, role)
);

-- Update media table to include chart information
ALTER TABLE media ADD COLUMN IF NOT EXISTS chart_position INTEGER;
ALTER TABLE media ADD COLUMN IF NOT EXISTS chart_name VARCHAR(200);
ALTER TABLE media ADD COLUMN IF NOT EXISTS chart_date DATE;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON artists(slug);
CREATE INDEX IF NOT EXISTS idx_playlists_created_by ON playlists(created_by);
CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_media_artists_media ON media_artists(media_id);
CREATE INDEX IF NOT EXISTS idx_media_artists_artist ON media_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_media_chart ON media(chart_name, chart_date);
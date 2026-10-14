CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) DEFAULT 'user',
    "is_active" BOOLEAN DEFAULT true,
    "email_verified" BOOLEAN DEFAULT false,
    "last_login" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "data_type" VARCHAR(20) DEFAULT 'string',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "data_type" VARCHAR(20) DEFAULT 'string',
    "description" TEXT,
    "is_public" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "url" VARCHAR(1000) NOT NULL,
    "platform" VARCHAR(50),
    "duration" INTEGER,
    "file_path" VARCHAR(1000),
    "thumbnail_path" VARCHAR(1000),
    "file_size" BIGINT,
    "format" VARCHAR(50),
    "quality" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'pending',
    "uploaded_by" UUID,
    "metadata" JSONB,
    "chart_position" INTEGER,
    "chart_name" VARCHAR(200),
    "chart_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "watch_time" INTEGER DEFAULT 0,
    "total_duration" INTEGER,
    "completed" BOOLEAN DEFAULT false,
    "last_position" INTEGER DEFAULT 0,
    "played_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "url" VARCHAR(1000) NOT NULL,
    "requested_by" UUID,
    "status" VARCHAR(20) DEFAULT 'queued',
    "progress" INTEGER DEFAULT 0,
    "quality" VARCHAR(20),
    "format" VARCHAR(20),
    "error_message" TEXT,
    "media_id" UUID,
    "retry_count" INTEGER DEFAULT 0,
    "max_retries" INTEGER DEFAULT 3,
    "priority" INTEGER DEFAULT 5,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "playlist_id" UUID,

    CONSTRAINT "download_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500),
    "image_url" TEXT,
    "genres" TEXT[],
    "bio" TEXT,
    "social_links" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "cover_image_url" TEXT,
    "is_public" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "total_tracks" INTEGER DEFAULT 0,
    "total_duration" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "playlist_id" UUID,
    "media_id" UUID,
    "position" INTEGER NOT NULL,
    "added_by" UUID,
    "added_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_artists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "media_id" UUID,
    "artist_id" UUID,
    "role" VARCHAR(100) DEFAULT 'artist',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "url" VARCHAR(1000) NOT NULL,
    "requested_by" UUID,
    "quality" VARCHAR(20),
    "format" VARCHAR(20),
    "status" VARCHAR(20) DEFAULT 'queued',
    "total_tracks" INTEGER DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500),
    "cover_image_url" TEXT,
    "release_date" DATE,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_albums" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "media_id" UUID NOT NULL,
    "album_id" UUID NOT NULL,
    "track_number" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_albums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_last_seen_idx" ON "users"("last_seen");

-- CreateIndex
CREATE INDEX "user_settings_user_id_idx" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "user_settings_setting_key_idx" ON "user_settings"("setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_setting_key_unique" ON "user_settings"("user_id", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_setting_key_key" ON "global_settings"("setting_key");

-- CreateIndex
CREATE INDEX "global_settings_setting_key_idx" ON "global_settings"("setting_key");

-- CreateIndex
CREATE INDEX "media_status_idx" ON "media"("status");

-- CreateIndex
CREATE INDEX "media_uploaded_by_idx" ON "media"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_platform_idx" ON "media"("platform");

-- CreateIndex
CREATE INDEX "media_chart_name_chart_date_idx" ON "media"("chart_name", "chart_date");

-- CreateIndex
CREATE INDEX "idx_media_created_at" ON "media"("created_at" DESC);

-- CreateIndex
CREATE INDEX "user_history_user_id_idx" ON "user_history"("user_id");

-- CreateIndex
CREATE INDEX "user_history_media_id_idx" ON "user_history"("media_id");

-- CreateIndex
CREATE INDEX "idx_user_history_played_at" ON "user_history"("played_at" DESC);

-- CreateIndex
CREATE INDEX "likes_user_id_idx" ON "likes"("user_id");

-- CreateIndex
CREATE INDEX "likes_media_id_idx" ON "likes"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_media_id_unique" ON "likes"("user_id", "media_id");

-- CreateIndex
CREATE INDEX "download_tasks_status_idx" ON "download_tasks"("status");

-- CreateIndex
CREATE INDEX "download_tasks_priority_idx" ON "download_tasks"("priority");

-- CreateIndex
CREATE INDEX "download_tasks_created_at_idx" ON "download_tasks"("created_at");

-- CreateIndex
CREATE INDEX "download_tasks_requested_by_idx" ON "download_tasks"("requested_by");

-- CreateIndex
CREATE INDEX "download_tasks_playlist_id_idx" ON "download_tasks"("playlist_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE INDEX "artists_slug_idx" ON "artists"("slug");

-- CreateIndex
CREATE INDEX "playlists_created_by_idx" ON "playlists"("created_by");

-- CreateIndex
CREATE INDEX "playlists_is_public_idx" ON "playlists"("is_public");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlist_id_idx" ON "playlist_tracks"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlist_id_position_idx" ON "playlist_tracks"("playlist_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_tracks_playlist_id_media_id_unique" ON "playlist_tracks"("playlist_id", "media_id");

-- CreateIndex
CREATE INDEX "media_artists_media_id_idx" ON "media_artists"("media_id");

-- CreateIndex
CREATE INDEX "media_artists_artist_id_idx" ON "media_artists"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_artists_media_id_artist_id_role_unique" ON "media_artists"("media_id", "artist_id", "role");

-- CreateIndex
CREATE INDEX "playlist_tasks_requested_by_idx" ON "playlist_tasks"("requested_by");

-- CreateIndex
CREATE INDEX "playlist_tasks_status_idx" ON "playlist_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "albums_slug_key" ON "albums"("slug");

-- CreateIndex
CREATE INDEX "albums_name_idx" ON "albums"("name");

-- CreateIndex
CREATE INDEX "albums_slug_idx" ON "albums"("slug");

-- CreateIndex
CREATE INDEX "media_albums_media_id_idx" ON "media_albums"("media_id");

-- CreateIndex
CREATE INDEX "media_albums_album_id_idx" ON "media_albums"("album_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_albums_media_id_album_id_unique" ON "media_albums"("media_id", "album_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlist_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_artists" ADD CONSTRAINT "media_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_artists" ADD CONSTRAINT "media_artists_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_tasks" ADD CONSTRAINT "playlist_tasks_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


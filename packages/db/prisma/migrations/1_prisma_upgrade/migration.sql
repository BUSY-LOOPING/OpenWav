CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS "pgmigrations";

CREATE TYPE "role" AS ENUM ('user', 'admin');
CREATE TYPE "media_status" AS ENUM ('pending', 'downloading', 'completed', 'failed', 'deleted');
CREATE TYPE "task_status" AS ENUM ('queued', 'downloading', 'uploading', 'completed', 'failed', 'cancelled');
CREATE TYPE "playlist_task_status" AS ENUM ('queued', 'resolving', 'downloading', 'completed', 'failed', 'cancelled');

ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_user_id_fkey";
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_uploaded_by_fkey";
ALTER TABLE "user_history" DROP CONSTRAINT IF EXISTS "user_history_media_id_fkey";
ALTER TABLE "user_history" DROP CONSTRAINT IF EXISTS "user_history_user_id_fkey";
ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_media_id_fkey";
ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_user_id_fkey";
ALTER TABLE "download_tasks" DROP CONSTRAINT IF EXISTS "download_tasks_media_id_fkey";
ALTER TABLE "download_tasks" DROP CONSTRAINT IF EXISTS "download_tasks_requested_by_fkey";
ALTER TABLE "download_tasks" DROP CONSTRAINT IF EXISTS "download_tasks_playlist_id_fkey";
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";
ALTER TABLE "playlists" DROP CONSTRAINT IF EXISTS "playlists_created_by_fkey";
ALTER TABLE "playlist_tracks" DROP CONSTRAINT IF EXISTS "playlist_tracks_added_by_fkey";
ALTER TABLE "playlist_tracks" DROP CONSTRAINT IF EXISTS "playlist_tracks_media_id_fkey";
ALTER TABLE "playlist_tracks" DROP CONSTRAINT IF EXISTS "playlist_tracks_playlist_id_fkey";
ALTER TABLE "media_artists" DROP CONSTRAINT IF EXISTS "media_artists_artist_id_fkey";
ALTER TABLE "media_artists" DROP CONSTRAINT IF EXISTS "media_artists_media_id_fkey";
ALTER TABLE "playlist_tasks" DROP CONSTRAINT IF EXISTS "playlist_tasks_requested_by_fkey";
ALTER TABLE "media_albums" DROP CONSTRAINT IF EXISTS "media_albums_album_id_fkey";
ALTER TABLE "media_albums" DROP CONSTRAINT IF EXISTS "media_albums_media_id_fkey";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_status_check";
ALTER TABLE "download_tasks" DROP CONSTRAINT IF EXISTS "download_tasks_status_check";
ALTER TABLE "playlist_tasks" DROP CONSTRAINT IF EXISTS "playlist_tasks_status_check";

UPDATE "users" SET "role" = 'user' WHERE "role" IS NULL OR "role" NOT IN ('user', 'admin');
UPDATE "users" SET "is_active" = COALESCE("is_active", true), "email_verified" = COALESCE("email_verified", false),
  "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "role" USING "role"::"role",
  ALTER COLUMN "role" SET DEFAULT 'user',
  ALTER COLUMN "role" SET NOT NULL,
  ALTER COLUMN "is_active" SET NOT NULL,
  ALTER COLUMN "email_verified" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

CREATE TEMP TABLE "media_dupes" AS
  SELECT "id", first_value("id") OVER (PARTITION BY "url", "format" ORDER BY ("status" = 'completed') DESC, ("metadata" IS NULL), "created_at", "id") AS "keep" FROM "media";
DELETE FROM "media_dupes" WHERE "id" = "keep";
UPDATE "download_tasks" t SET "media_id" = d."keep" FROM "media_dupes" d WHERE t."media_id" = d."id";
UPDATE "likes" t SET "media_id" = d."keep" FROM "media_dupes" d
  WHERE t."media_id" = d."id" AND NOT EXISTS (SELECT 1 FROM "likes" x WHERE x."user_id" = t."user_id" AND x."media_id" = d."keep");
UPDATE "playlist_tracks" t SET "media_id" = d."keep" FROM "media_dupes" d
  WHERE t."media_id" = d."id" AND NOT EXISTS (SELECT 1 FROM "playlist_tracks" x WHERE x."playlist_id" = t."playlist_id" AND x."media_id" = d."keep");
UPDATE "user_history" t SET "media_id" = d."keep" FROM "media_dupes" d WHERE t."media_id" = d."id";
DELETE FROM "media_artists" WHERE "media_id" IN (SELECT "id" FROM "media_dupes");
DELETE FROM "media_albums" WHERE "media_id" IN (SELECT "id" FROM "media_dupes");
DELETE FROM "media" WHERE "id" IN (SELECT "id" FROM "media_dupes");

UPDATE "media" SET "status" = 'pending' WHERE "status" IS NULL OR "status" NOT IN ('pending', 'downloading', 'completed', 'failed', 'deleted');
UPDATE "media" SET "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "media"
  DROP COLUMN IF EXISTS "chart_date",
  DROP COLUMN IF EXISTS "chart_name",
  DROP COLUMN IF EXISTS "chart_position",
  ADD COLUMN "play_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "source_id" VARCHAR(100),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "media_status" USING "status"::"media_status",
  ALTER COLUMN "status" SET DEFAULT 'pending',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;
UPDATE "media" SET "source_id" = "metadata"->'raw'->>'id' WHERE "metadata" ? 'raw';

CREATE TEMP TABLE "history_rollup" AS
  SELECT "user_id", "media_id", count(*)::int AS "plays", max("watch_time") AS "watch_time",
    (array_agg("id" ORDER BY "played_at" DESC NULLS LAST))[1] AS "keep"
  FROM "user_history" GROUP BY "user_id", "media_id";
ALTER TABLE "user_history" ADD COLUMN "play_count" INTEGER NOT NULL DEFAULT 1;
DELETE FROM "user_history" h USING "history_rollup" r
  WHERE h."user_id" = r."user_id" AND h."media_id" = r."media_id" AND h."id" <> r."keep";
UPDATE "user_history" h SET "play_count" = r."plays", "watch_time" = COALESCE(r."watch_time", 0) FROM "history_rollup" r WHERE h."id" = r."keep";
UPDATE "user_history" SET "watch_time" = COALESCE("watch_time", 0), "completed" = COALESCE("completed", false),
  "last_position" = COALESCE("last_position", 0), "played_at" = COALESCE("played_at", now()), "updated_at" = COALESCE("updated_at", now());
UPDATE "media" m SET "play_count" = s."plays" FROM (SELECT "media_id", sum("play_count")::int AS "plays" FROM "user_history" GROUP BY "media_id") s WHERE m."id" = s."media_id";
ALTER TABLE "user_history"
  ALTER COLUMN "watch_time" SET NOT NULL,
  ALTER COLUMN "completed" SET NOT NULL,
  ALTER COLUMN "last_position" SET NOT NULL,
  ALTER COLUMN "played_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

DELETE FROM "likes" WHERE "media_id" IN (SELECT "id" FROM "media_dupes");
UPDATE "likes" SET "created_at" = COALESCE("created_at", now());
ALTER TABLE "likes" ALTER COLUMN "created_at" SET NOT NULL;

UPDATE "download_tasks" SET "status" = 'queued' WHERE "status" IS NULL OR "status" NOT IN ('queued', 'downloading', 'uploading', 'completed', 'failed', 'cancelled');
UPDATE "download_tasks" SET "progress" = COALESCE("progress", 0), "retry_count" = COALESCE("retry_count", 0),
  "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "download_tasks"
  DROP COLUMN IF EXISTS "max_retries",
  DROP COLUMN IF EXISTS "priority",
  ADD COLUMN "position" INTEGER,
  ADD COLUMN "target_playlist_id" UUID,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "task_status" USING "status"::"task_status",
  ALTER COLUMN "status" SET DEFAULT 'queued',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "progress" SET NOT NULL,
  ALTER COLUMN "retry_count" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

UPDATE "refresh_tokens" SET "created_at" = COALESCE("created_at", now());
DELETE FROM "refresh_tokens" a USING "refresh_tokens" b WHERE a."token_hash" = b."token_hash" AND a."id" > b."id";
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET NOT NULL;

UPDATE "artists" SET "slug" = "id"::text WHERE "slug" IS NULL;
UPDATE "artists" SET "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "artists"
  DROP COLUMN IF EXISTS "social_links",
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

UPDATE "playlists" SET "is_public" = COALESCE("is_public", true), "total_tracks" = COALESCE("total_tracks", 0),
  "total_duration" = COALESCE("total_duration", 0), "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "playlists"
  ALTER COLUMN "is_public" SET NOT NULL,
  ALTER COLUMN "total_tracks" SET NOT NULL,
  ALTER COLUMN "total_duration" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

DELETE FROM "playlist_tracks" WHERE "playlist_id" IS NULL OR "media_id" IS NULL OR "media_id" IN (SELECT "id" FROM "media_dupes");
UPDATE "playlist_tracks" SET "added_at" = COALESCE("added_at", now());
ALTER TABLE "playlist_tracks"
  ALTER COLUMN "playlist_id" SET NOT NULL,
  ALTER COLUMN "media_id" SET NOT NULL,
  ALTER COLUMN "added_at" SET NOT NULL;

ALTER TABLE "media_artists" DROP CONSTRAINT IF EXISTS "media_artists_media_id_artist_id_role_unique";
DROP INDEX IF EXISTS "media_artists_media_id_artist_id_role_unique";
DELETE FROM "media_artists" WHERE "media_id" IS NULL OR "artist_id" IS NULL;
UPDATE "media_artists" SET "role" = COALESCE("role", 'artist'), "created_at" = COALESCE("created_at", now());
DELETE FROM "media_artists" a USING "media_artists" b
  WHERE a."media_id" = b."media_id" AND a."artist_id" = b."artist_id" AND a."role" = b."role" AND a."id" > b."id";
ALTER TABLE "media_artists"
  DROP CONSTRAINT "media_artists_pkey",
  DROP COLUMN "id",
  ALTER COLUMN "media_id" SET NOT NULL,
  ALTER COLUMN "artist_id" SET NOT NULL,
  ALTER COLUMN "role" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ADD CONSTRAINT "media_artists_pkey" PRIMARY KEY ("media_id", "artist_id", "role");

UPDATE "playlist_tasks" SET "status" = 'queued' WHERE "status" IS NULL OR "status" NOT IN ('queued', 'resolving', 'downloading', 'completed', 'failed', 'cancelled');
UPDATE "playlist_tasks" SET "total_tracks" = COALESCE("total_tracks", 0), "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "playlist_tasks"
  ADD COLUMN "target_playlist_id" UUID,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "playlist_task_status" USING "status"::"playlist_task_status",
  ALTER COLUMN "status" SET DEFAULT 'queued',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "total_tracks" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

UPDATE "albums" SET "slug" = "id"::text WHERE "slug" IS NULL;
UPDATE "albums" SET "created_at" = COALESCE("created_at", now()), "updated_at" = COALESCE("updated_at", now());
ALTER TABLE "albums"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "media_albums" DROP CONSTRAINT IF EXISTS "media_albums_media_id_album_id_unique";
DROP INDEX IF EXISTS "media_albums_media_id_album_id_unique";
UPDATE "media_albums" SET "created_at" = COALESCE("created_at", now());
DELETE FROM "media_albums" a USING "media_albums" b
  WHERE a."media_id" = b."media_id" AND a."album_id" = b."album_id" AND a."id" > b."id";
ALTER TABLE "media_albums"
  DROP CONSTRAINT "media_albums_pkey",
  DROP COLUMN "id",
  ALTER COLUMN "created_at" SET NOT NULL,
  ADD CONSTRAINT "media_albums_pkey" PRIMARY KEY ("media_id", "album_id");

CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "settings" ("key", "value")
SELECT m."new_key",
  CASE g."data_type"
    WHEN 'number' THEN to_jsonb(g."setting_value"::numeric)
    WHEN 'boolean' THEN to_jsonb(g."setting_value" = 'true')
    WHEN 'json' THEN g."setting_value"::jsonb
    ELSE to_jsonb(g."setting_value")
  END
FROM "global_settings" g
JOIN (VALUES
  ('max_downloads_per_user_per_day', 'downloads.max_per_user_per_day'),
  ('allowed_domains', 'downloads.allowed_domains'),
  ('registration_enabled', 'auth.registration_enabled'),
  ('default_audio_quality', 'downloads.default_quality')
) AS m("old_key", "new_key") ON m."old_key" = g."setting_key"
WHERE g."setting_value" IS NOT NULL;

CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id", "key")
);

INSERT INTO "user_preferences" ("user_id", "key", "value")
SELECT "user_id", "setting_key",
  CASE "data_type"
    WHEN 'number' THEN to_jsonb("setting_value"::numeric)
    WHEN 'boolean' THEN to_jsonb("setting_value" = 'true')
    WHEN 'json' THEN "setting_value"::jsonb
    ELSE to_jsonb("setting_value")
  END
FROM "user_settings" WHERE "setting_value" IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TABLE "user_settings";
DROP TABLE "global_settings";

CREATE TABLE "playlist_saves" (
    "user_id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playlist_saves_pkey" PRIMARY KEY ("user_id", "playlist_id")
);

CREATE TABLE "artist_subscriptions" (
    "user_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artist_subscriptions_pkey" PRIMARY KEY ("user_id", "artist_id")
);

DROP INDEX IF EXISTS "users_email_idx";
DROP INDEX IF EXISTS "users_email_index";
DROP INDEX IF EXISTS "users_username_idx";
DROP INDEX IF EXISTS "users_username_index";
DROP INDEX IF EXISTS "media_status_idx";
DROP INDEX IF EXISTS "media_status_index";
DROP INDEX IF EXISTS "media_platform_idx";
DROP INDEX IF EXISTS "media_platform_index";
DROP INDEX IF EXISTS "media_chart_name_chart_date_idx";
DROP INDEX IF EXISTS "media_chart_name_chart_date_index";
DROP INDEX IF EXISTS "idx_media_created_at";
DROP INDEX IF EXISTS "user_history_user_id_idx";
DROP INDEX IF EXISTS "user_history_user_id_index";
DROP INDEX IF EXISTS "idx_user_history_played_at";
DROP INDEX IF EXISTS "likes_user_id_idx";
DROP INDEX IF EXISTS "likes_user_id_index";
DROP INDEX IF EXISTS "download_tasks_status_idx";
DROP INDEX IF EXISTS "download_tasks_status_index";
DROP INDEX IF EXISTS "download_tasks_priority_idx";
DROP INDEX IF EXISTS "download_tasks_priority_index";
DROP INDEX IF EXISTS "download_tasks_created_at_idx";
DROP INDEX IF EXISTS "download_tasks_created_at_index";
DROP INDEX IF EXISTS "download_tasks_requested_by_idx";
DROP INDEX IF EXISTS "download_tasks_requested_by_index";
DROP INDEX IF EXISTS "idx_download_tasks_worker";
DROP INDEX IF EXISTS "artists_slug_idx";
DROP INDEX IF EXISTS "artists_slug_index";
DROP INDEX IF EXISTS "playlists_is_public_idx";
DROP INDEX IF EXISTS "playlists_is_public_index";
DROP INDEX IF EXISTS "playlist_tracks_playlist_id_idx";
DROP INDEX IF EXISTS "playlist_tracks_playlist_id_index";
DROP INDEX IF EXISTS "media_artists_media_id_idx";
DROP INDEX IF EXISTS "media_artists_media_id_index";
DROP INDEX IF EXISTS "albums_slug_idx";
DROP INDEX IF EXISTS "albums_slug_index";
DROP INDEX IF EXISTS "media_albums_media_id_idx";
DROP INDEX IF EXISTS "media_albums_media_id_index";

ALTER INDEX IF EXISTS "users_role_index" RENAME TO "users_role_idx";
ALTER INDEX IF EXISTS "users_last_seen_index" RENAME TO "users_last_seen_idx";
ALTER INDEX IF EXISTS "refresh_tokens_user_id_index" RENAME TO "refresh_tokens_user_id_idx";
ALTER INDEX IF EXISTS "refresh_tokens_expires_at_index" RENAME TO "refresh_tokens_expires_at_idx";
ALTER INDEX IF EXISTS "media_uploaded_by_index" RENAME TO "media_uploaded_by_idx";
ALTER INDEX IF EXISTS "user_history_media_id_index" RENAME TO "user_history_media_id_idx";
ALTER INDEX IF EXISTS "likes_media_id_index" RENAME TO "likes_media_id_idx";
ALTER INDEX IF EXISTS "download_tasks_playlist_id_index" RENAME TO "download_tasks_playlist_id_idx";
ALTER INDEX IF EXISTS "playlist_tasks_requested_by_index" RENAME TO "playlist_tasks_requested_by_idx";
ALTER INDEX IF EXISTS "playlist_tasks_status_index" RENAME TO "playlist_tasks_status_idx";
ALTER INDEX IF EXISTS "artists_name_index" RENAME TO "artists_name_idx";
ALTER INDEX IF EXISTS "media_artists_artist_id_index" RENAME TO "media_artists_artist_id_idx";
ALTER INDEX IF EXISTS "albums_name_index" RENAME TO "albums_name_idx";
ALTER INDEX IF EXISTS "media_albums_album_id_index" RENAME TO "media_albums_album_id_idx";
ALTER INDEX IF EXISTS "playlists_created_by_index" RENAME TO "playlists_created_by_idx";
ALTER INDEX IF EXISTS "playlist_tracks_playlist_id_position_index" RENAME TO "playlist_tracks_playlist_id_position_idx";
ALTER INDEX IF EXISTS "likes_user_id_media_id_unique" RENAME TO "likes_user_id_media_id_key";
ALTER INDEX IF EXISTS "playlist_tracks_playlist_id_media_id_unique" RENAME TO "playlist_tracks_playlist_id_media_id_key";

CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_last_seen_idx" ON "users"("last_seen");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "media_status_created_at_idx" ON "media"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "media_uploaded_by_idx" ON "media"("uploaded_by");
CREATE INDEX "media_source_id_idx" ON "media"("source_id");
CREATE UNIQUE INDEX "media_url_format_key" ON "media"("url", "format");
CREATE INDEX "user_history_user_id_played_at_idx" ON "user_history"("user_id", "played_at" DESC);
CREATE INDEX IF NOT EXISTS "user_history_media_id_idx" ON "user_history"("media_id");
CREATE UNIQUE INDEX "user_history_user_id_media_id_key" ON "user_history"("user_id", "media_id");
CREATE INDEX IF NOT EXISTS "likes_media_id_idx" ON "likes"("media_id");
CREATE INDEX "download_tasks_status_updated_at_idx" ON "download_tasks"("status", "updated_at");
CREATE INDEX "download_tasks_requested_by_created_at_idx" ON "download_tasks"("requested_by", "created_at" DESC);
CREATE INDEX "download_tasks_created_at_idx" ON "download_tasks"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "download_tasks_playlist_id_idx" ON "download_tasks"("playlist_id");
CREATE INDEX IF NOT EXISTS "playlist_tasks_requested_by_idx" ON "playlist_tasks"("requested_by");
CREATE INDEX IF NOT EXISTS "playlist_tasks_status_idx" ON "playlist_tasks"("status");
CREATE INDEX IF NOT EXISTS "artists_name_idx" ON "artists"("name");
CREATE INDEX IF NOT EXISTS "media_artists_artist_id_idx" ON "media_artists"("artist_id");
CREATE INDEX IF NOT EXISTS "albums_name_idx" ON "albums"("name");
CREATE INDEX IF NOT EXISTS "media_albums_album_id_idx" ON "media_albums"("album_id");
CREATE INDEX IF NOT EXISTS "playlists_created_by_idx" ON "playlists"("created_by");
CREATE INDEX "playlists_is_public_created_at_idx" ON "playlists"("is_public", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "playlist_tracks_playlist_id_position_idx" ON "playlist_tracks"("playlist_id", "position");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "media_title_trgm_idx" ON "media" USING gin ("title" gin_trgm_ops);
CREATE INDEX "artists_name_trgm_idx" ON "artists" USING gin ("name" gin_trgm_ops);

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_history" ADD CONSTRAINT "user_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlist_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_target_playlist_id_fkey" FOREIGN KEY ("target_playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_tasks" ADD CONSTRAINT "playlist_tasks_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_tasks" ADD CONSTRAINT "playlist_tasks_target_playlist_id_fkey" FOREIGN KEY ("target_playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_artists" ADD CONSTRAINT "media_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_artists" ADD CONSTRAINT "media_artists_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_saves" ADD CONSTRAINT "playlist_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_saves" ADD CONSTRAINT "playlist_saves_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artist_subscriptions" ADD CONSTRAINT "artist_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artist_subscriptions" ADD CONSTRAINT "artist_subscriptions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

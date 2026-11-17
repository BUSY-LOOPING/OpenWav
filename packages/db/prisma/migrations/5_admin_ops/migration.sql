ALTER TABLE "users" ADD COLUMN "can_download" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "daily_download_limit" INTEGER,
ADD COLUMN "max_quality" VARCHAR(10);

ALTER TABLE "refresh_tokens" ADD COLUMN "session_id" UUID NOT NULL DEFAULT uuid_generate_v4(),
ADD COLUMN "user_agent" VARCHAR(500),
ADD COLUMN "ip" VARCHAR(64);

CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" VARCHAR(200),
    "details" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "play_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "played_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "play_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "play_events_played_at_idx" ON "play_events"("played_at");
CREATE INDEX "play_events_media_id_idx" ON "play_events"("media_id");
ALTER TABLE "play_events" ADD CONSTRAINT "play_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "play_events" ADD CONSTRAINT "play_events_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "search_misses" (
    "term" VARCHAR(200) NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "search_misses_pkey" PRIMARY KEY ("term","day")
);

CREATE INDEX "search_misses_day_idx" ON "search_misses"("day");

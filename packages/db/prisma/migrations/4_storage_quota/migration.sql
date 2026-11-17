ALTER TABLE "users" ADD COLUMN "storage_quota_bytes" BIGINT;

CREATE INDEX "download_tasks_requested_by_status_idx" ON "download_tasks"("requested_by", "status");

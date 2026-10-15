BEGIN;

-- 1. Create sync_revisions table
CREATE TABLE IF NOT EXISTS "sync_revisions" (
  "resource_group" VARCHAR(50) NOT NULL PRIMARY KEY,
  "revision" UUID NOT NULL DEFAULT gen_random_uuid(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Seed initial resource groups
INSERT INTO "sync_revisions" ("resource_group", "revision", "updated_at")
VALUES
  ('tasks', gen_random_uuid(), CURRENT_TIMESTAMP),
  ('events', gen_random_uuid(), CURRENT_TIMESTAMP),
  ('gems', gen_random_uuid(), CURRENT_TIMESTAMP),
  ('notifications', gen_random_uuid(), CURRENT_TIMESTAMP),
  ('semesters', gen_random_uuid(), CURRENT_TIMESTAMP),
  ('members', gen_random_uuid(), CURRENT_TIMESTAMP)
ON CONFLICT ("resource_group") DO NOTHING;

-- 3. Row Level Security & permissions
ALTER TABLE "sync_revisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "sync_revisions" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "sync_revisions" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "sync_revisions" FROM authenticated;
  END IF;
END $$;

-- 4. Shared statement-level trigger function
CREATE OR REPLACE FUNCTION update_sync_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "sync_revisions"
  SET "revision" = gen_random_uuid(), "updated_at" = CURRENT_TIMESTAMP
  WHERE "resource_group" = TG_ARGV[0];
  RETURN NULL;
END;
$$;

-- 5. Triggers on operational tables
-- Tasks & Assignees
CREATE TRIGGER sync_tasks_changed AFTER INSERT OR UPDATE OR DELETE ON "tasks"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('tasks');

CREATE TRIGGER sync_task_assignees_changed AFTER INSERT OR UPDATE OR DELETE ON "task_assignees"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('tasks');

-- Events & Event Contributions
CREATE TRIGGER sync_events_changed AFTER INSERT OR UPDATE OR DELETE ON "events"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('events');

CREATE TRIGGER sync_event_contributions_changed AFTER INSERT OR UPDATE OR DELETE ON "event_contributions"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('events');

-- Gems Transactions
CREATE TRIGGER sync_gems_changed AFTER INSERT OR UPDATE OR DELETE ON "gems_transactions"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('gems');

-- Notifications & Reads
CREATE TRIGGER sync_notifications_changed AFTER INSERT OR UPDATE OR DELETE ON "notifications"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('notifications');

CREATE TRIGGER sync_notification_reads_changed AFTER INSERT OR UPDATE OR DELETE ON "notification_reads"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('notifications');

-- Semesters & Tenures
CREATE TRIGGER sync_semesters_changed AFTER INSERT OR UPDATE OR DELETE ON "semesters"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('semesters');

CREATE TRIGGER sync_tenures_changed AFTER INSERT OR UPDATE OR DELETE ON "tenures"
FOR EACH STATEMENT EXECUTE FUNCTION update_sync_revision('semesters');

-- 6. Members & Tenures triggers (selective on business columns, ignoring token/session updates)
CREATE OR REPLACE FUNCTION update_sync_revision_users() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') OR (TG_OP = 'INSERT') OR
     (OLD."fullName" IS DISTINCT FROM NEW."fullName") OR
     (OLD."avatarUrl" IS DISTINCT FROM NEW."avatarUrl") OR
     (OLD."coverUrl" IS DISTINCT FROM NEW."coverUrl") OR
     (OLD."email" IS DISTINCT FROM NEW."email") OR
     (OLD."phoneNumber" IS DISTINCT FROM NEW."phoneNumber") THEN
    UPDATE "sync_revisions"
    SET "revision" = gen_random_uuid(), "updated_at" = CURRENT_TIMESTAMP
    WHERE "resource_group" = 'members';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_users_changed AFTER INSERT OR UPDATE OR DELETE ON "users"
FOR EACH ROW EXECUTE FUNCTION update_sync_revision_users();

CREATE OR REPLACE FUNCTION update_sync_revision_user_tenures() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'DELETE') OR (TG_OP = 'INSERT') OR
     (OLD.role IS DISTINCT FROM NEW.role) OR
     (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD."departmentId" IS DISTINCT FROM NEW."departmentId") OR
     (OLD.position IS DISTINCT FROM NEW.position) THEN
    UPDATE "sync_revisions"
    SET "revision" = gen_random_uuid(), "updated_at" = CURRENT_TIMESTAMP
    WHERE "resource_group" = 'members';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_user_tenures_changed AFTER INSERT OR UPDATE OR DELETE ON "user_tenures"
FOR EACH ROW EXECUTE FUNCTION update_sync_revision_user_tenures();

COMMIT;

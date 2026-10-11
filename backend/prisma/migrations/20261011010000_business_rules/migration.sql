BEGIN;
-- Existing credentials are preserved; the first authenticated visit requires a password change.
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
CREATE TYPE "Role_new" AS ENUM ('ADVISOR','LEAD','DEPARTMENT_LEAD','MEMBER','ADMIN');
ALTER TABLE "user_tenures" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user_tenures" ALTER COLUMN "role" TYPE "Role_new" USING (CASE WHEN "role"::text = 'COLLABORATOR' THEN 'MEMBER' ELSE "role"::text END)::"Role_new";
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE "user_tenures" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
CREATE TABLE "semesters" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "tenureId" TEXT NOT NULL,
 "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
 "isClosed" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "semesters_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "semesters_tenureId_fkey" FOREIGN KEY ("tenureId") REFERENCES "tenures"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "semesters_tenureId_name_key" ON "semesters"("tenureId","name");
-- One initial semester per legacy tenure. Do not invent or reset historical Gems balances.
INSERT INTO "semesters" ("id","name","tenureId","startDate","endDate","isClosed")
 SELECT 'legacy-semester-' || "id", "name", "id", "startDate", "endDate", "isArchived" OR "isFrozen" FROM "tenures";
ALTER TABLE "tasks" ADD COLUMN "semesterId" TEXT, ADD COLUMN "completedAt" TIMESTAMP(3);
UPDATE "tasks" SET "semesterId" = 'legacy-semester-' || "tenureId", "completedAt" = CASE WHEN "status" = 'DONE' THEN "updatedAt" ELSE NULL END;
ALTER TABLE "tasks" ALTER COLUMN "semesterId" SET NOT NULL;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD COLUMN "semesterId" TEXT;
UPDATE "events" SET "semesterId" = 'legacy-semester-' || "tenureId";
ALTER TABLE "events" ALTER COLUMN "semesterId" SET NOT NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" RENAME COLUMN "organizerGems" TO "contributionGems";
ALTER TABLE "events" ALTER COLUMN "contributionGems" SET DEFAULT 20;
ALTER TABLE "events" DROP COLUMN "attendeeGems";
CREATE TABLE "event_contributions" (
 "id" TEXT NOT NULL, "eventId" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "roleInEvent" TEXT, "notes" TEXT, "isGemsGranted" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "event_contributions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "event_contributions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "event_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_contributions_eventId_userId_key" ON "event_contributions"("eventId","userId");
-- Organizers represent work contributions. Audience attendance does not prove work contribution.
INSERT INTO "event_contributions" ("id","eventId","userId","roleInEvent","isGemsGranted")
 SELECT o."id",o."eventId",o."userId",o."roleInEvent",o."isGemsGranted" OR EXISTS (
 SELECT 1 FROM "gems_transactions" g WHERE g."referenceId"=o."eventId" AND g."userId"=o."userId" AND g."type"='EVENT_ORGANIZER') FROM "event_organizers" o;
-- Back up old attendance/gift tables before deploying this explicitly requested removal.
DROP TABLE "event_attendances";
DROP TABLE "event_organizers";
DROP TYPE "CheckinMethod";
DROP TABLE "gift_redemptions";
DROP TABLE "gift_items";
DROP TYPE "RedemptionStatus";
CREATE TYPE "GemsTransactionType_new" AS ENUM ('TASK_REWARD','EVENT_CONTRIBUTION','MANUAL_ADJUSTMENT');
ALTER TABLE "gems_transactions" ALTER COLUMN "type" TYPE "GemsTransactionType_new" USING
 (CASE WHEN "type"::text IN ('EVENT_ATTENDANCE','EVENT_ORGANIZER') THEN 'EVENT_CONTRIBUTION' WHEN "type"::text='GIFT_REDEMPTION' THEN 'MANUAL_ADJUSTMENT' ELSE "type"::text END)::"GemsTransactionType_new";
DROP TYPE "GemsTransactionType";
ALTER TYPE "GemsTransactionType_new" RENAME TO "GemsTransactionType";
ALTER TABLE "gems_transactions" ADD COLUMN "semesterId" TEXT;
UPDATE "gems_transactions" g SET "semesterId"=t."semesterId" FROM "tasks" t WHERE g."type"='TASK_REWARD' AND g."referenceId"=t."id";
UPDATE "gems_transactions" g SET "semesterId"=e."semesterId" FROM "events" e WHERE g."type"='EVENT_CONTRIBUTION' AND g."referenceId"=e."id";
ALTER TABLE "gems_transactions" ADD CONSTRAINT "gems_transactions_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD COLUMN "targetUserId" TEXT;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- PostgreSQL delivers NOTIFY only on commit; every API instance can subscribe via LISTEN.
CREATE FUNCTION gdgoc_publish_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('gdgoc_updates', '{"userIds":[],"resources":["tasks","events","gems","notifications","generation"]}');
 RETURN NULL;
END;
$$;
CREATE TRIGGER gdgoc_tasks_changed AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_assignees_changed AFTER INSERT OR UPDATE OR DELETE ON task_assignees FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_events_changed AFTER INSERT OR UPDATE OR DELETE ON events FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_contributions_changed AFTER INSERT OR UPDATE OR DELETE ON event_contributions FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_gems_changed AFTER INSERT OR UPDATE OR DELETE ON gems_transactions FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_notifications_changed AFTER INSERT OR UPDATE OR DELETE ON notifications FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
CREATE TRIGGER gdgoc_periods_changed AFTER INSERT OR UPDATE OR DELETE ON semesters FOR EACH STATEMENT EXECUTE FUNCTION gdgoc_publish_changes();
COMMIT;

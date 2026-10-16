-- Set default status of tasks to IN_PROGRESS
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS'::"TaskStatus";

-- Migrate any legacy TODO or BACKLOG tasks to IN_PROGRESS
UPDATE "tasks" SET "status" = 'IN_PROGRESS' WHERE "status" = 'TODO' OR "status" = 'BACKLOG';

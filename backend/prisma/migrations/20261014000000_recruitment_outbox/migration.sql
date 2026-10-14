CREATE SEQUENCE "recruitment_candidate_seq" START WITH 1000001;
CREATE TYPE "RecruitmentSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'FAILED');
CREATE TABLE "recruitment_applications" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL DEFAULT ('UV' || nextval('recruitment_candidate_seq'::regclass)::text),
  "requestId" TEXT NOT NULL,
  "cycle" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "syncStatus" "RecruitmentSyncStatus" NOT NULL DEFAULT 'PENDING',
  "syncAttempts" INTEGER NOT NULL DEFAULT 0,
  "syncError" TEXT,
  "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recruitment_applications_candidateId_key" ON "recruitment_applications"("candidateId");
CREATE UNIQUE INDEX "recruitment_applications_requestId_key" ON "recruitment_applications"("requestId");
CREATE UNIQUE INDEX "recruitment_applications_cycle_email_key" ON "recruitment_applications"("cycle", "email");
CREATE UNIQUE INDEX "recruitment_applications_cycle_studentId_key" ON "recruitment_applications"("cycle", "studentId");
CREATE INDEX "recruitment_applications_syncStatus_nextSyncAt_idx" ON "recruitment_applications"("syncStatus", "nextSyncAt");
ALTER TABLE "recruitment_applications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "recruitment_applications" FROM PUBLIC;
REVOKE ALL ON SEQUENCE "recruitment_candidate_seq" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "recruitment_applications" FROM anon;
    REVOKE ALL ON SEQUENCE "recruitment_candidate_seq" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "recruitment_applications" FROM authenticated;
    REVOKE ALL ON SEQUENCE "recruitment_candidate_seq" FROM authenticated;
  END IF;
END $$;

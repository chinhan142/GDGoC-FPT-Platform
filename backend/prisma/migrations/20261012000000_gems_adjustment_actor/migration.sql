ALTER TABLE "gems_transactions" ADD COLUMN "actorId" TEXT;
CREATE INDEX "gems_transactions_actorId_idx" ON "gems_transactions"("actorId");
ALTER TABLE "gems_transactions" ADD CONSTRAINT "gems_transactions_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

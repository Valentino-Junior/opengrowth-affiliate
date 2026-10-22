-- DropIndex
DROP INDEX "transactions_method_external_ref_key";

-- CreateIndex
CREATE INDEX "transactions_method_external_ref_idx" ON "transactions"("method", "external_ref");

-- A payment reference can be logged once. A rejected entry doesn't count, so the corrected entry can reuse it.
CREATE UNIQUE INDEX "transactions_method_external_ref_live"
  ON "transactions" ("method", "external_ref")
  WHERE "status" <> 'rejected';

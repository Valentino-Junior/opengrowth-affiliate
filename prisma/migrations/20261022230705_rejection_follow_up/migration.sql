-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "rejection_handled_at" TIMESTAMPTZ,
ADD COLUMN     "rejection_handled_by" UUID,
ADD COLUMN     "replaces_id" UUID;

-- CreateIndex
CREATE INDEX "transactions_replaces_id_idx" ON "transactions"("replaces_id");

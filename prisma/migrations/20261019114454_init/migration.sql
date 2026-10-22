-- CreateEnum
CREATE TYPE "Role" AS ENUM ('affiliate', 'employee', 'ops', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('email', 'phone', 'payment_handle');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('affiliate', 'player');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash_app', 'chime', 'apple_pay', 'venmo', 'google_pay', 'paypal', 'crypto');

-- CreateEnum
CREATE TYPE "IdStatus" AS ENUM ('none', 'submitted', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('pending_approval', 'active', 'inactive', 'flagged', 'disqualified');

-- CreateEnum
CREATE TYPE "IdDocStatus" AS ENUM ('submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "LinkSource" AS ENUM ('link', 'code_at_desk', 'ops_tag');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('pending', 'confirmed', 'rejected', 'sent_to_ops');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('deposit', 'cashout');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('open', 'closed', 'paid');

-- CreateEnum
CREATE TYPE "AffiliateWeekStatus" AS ENUM ('ready', 'carried', 'under_minimum', 'flagged', 'needs_id', 'paid');

-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('live', 'closed', 'prizes_released');

-- CreateEnum
CREATE TYPE "PrizeStatus" AS ENUM ('awaiting_id', 'on_hold', 'released');

-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('email_match', 'phone_match', 'payment_handle_match', 'duplicate_account', 'other');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('open', 'cleared', 'disqualified');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "phone_verified_at" TIMESTAMPTZ,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_registry" (
    "id" UUID NOT NULL,
    "kind" "ContactKind" NOT NULL,
    "value_normalized" TEXT NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contact_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "referral_code" TEXT,
    "payout_method" "PaymentMethod",
    "payout_handle" TEXT,
    "id_status" "IdStatus" NOT NULL DEFAULT 'none',
    "carry_forward_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending_approval',
    "legacy_builder" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "display_code" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "shift_start" TEXT,
    "shift_end" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_documents" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "front_key" TEXT NOT NULL,
    "selfie_key" TEXT NOT NULL,
    "name_on_id" TEXT NOT NULL,
    "status" "IdDocStatus" NOT NULL DEFAULT 'submitted',
    "reviewed_by" UUID,
    "reject_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "id_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "payment_handle" TEXT,
    "affiliate_id" UUID,
    "link_source" "LinkSource",
    "link_status" "LinkStatus" NOT NULL DEFAULT 'pending',
    "link_confirmed_by" UUID,
    "link_confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "affiliate_id" UUID,
    "type" "TxType" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "external_ref" TEXT NOT NULL,
    "screenshot_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'pending',
    "entered_by" UUID NOT NULL,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ,
    "reject_reason" TEXT,
    "week_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_edits" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transaction_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "payout_date" DATE NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'open',
    "rate_bp" INTEGER,
    "min_payout_cents" BIGINT,
    "id_threshold_cents" BIGINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_weeks" (
    "id" UUID NOT NULL,
    "week_id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "player_count" INTEGER NOT NULL DEFAULT 0,
    "deposits_cents" BIGINT NOT NULL DEFAULT 0,
    "cashouts_cents" BIGINT NOT NULL DEFAULT 0,
    "gross_profit_cents" BIGINT NOT NULL DEFAULT 0,
    "carry_in_cents" BIGINT NOT NULL DEFAULT 0,
    "net_cents" BIGINT NOT NULL DEFAULT 0,
    "commission_cents" BIGINT NOT NULL DEFAULT 0,
    "rolled_in_cents" BIGINT NOT NULL DEFAULT 0,
    "payable_cents" BIGINT NOT NULL DEFAULT 0,
    "carry_out_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "AffiliateWeekStatus" NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "paid_by" UUID,
    "payment_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "affiliate_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_months" (
    "id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "status" "RaceStatus" NOT NULL DEFAULT 'live',
    "prize_1" TEXT NOT NULL DEFAULT 'A car',
    "prize_2" TEXT NOT NULL DEFAULT 'A dirt bike',
    "prize_3" TEXT NOT NULL DEFAULT 'An iPhone',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "race_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_results" (
    "id" UUID NOT NULL,
    "race_month_id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "gross_profit_cents" BIGINT NOT NULL,
    "rank" INTEGER,
    "excluded_reason" TEXT,
    "prize_status" "PrizeStatus",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "race_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" UUID NOT NULL,
    "affiliate_id" UUID NOT NULL,
    "player_id" UUID,
    "reason" "FlagReason" NOT NULL,
    "detail" TEXT,
    "status" "FlagStatus" NOT NULL DEFAULT 'open',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "contact_registry_kind_value_normalized_idx" ON "contact_registry"("kind", "value_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_user_id_key" ON "affiliates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_referral_code_key" ON "affiliates"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_display_code_key" ON "staff"("display_code");

-- CreateIndex
CREATE INDEX "id_documents_affiliate_id_idx" ON "id_documents"("affiliate_id");

-- CreateIndex
CREATE UNIQUE INDEX "players_handle_key" ON "players"("handle");

-- CreateIndex
CREATE INDEX "players_affiliate_id_idx" ON "players"("affiliate_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_affiliate_id_occurred_at_idx" ON "transactions"("affiliate_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_method_external_ref_key" ON "transactions"("method", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_starts_on_key" ON "weeks"("starts_on");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_weeks_week_id_affiliate_id_key" ON "affiliate_weeks"("week_id", "affiliate_id");

-- CreateIndex
CREATE UNIQUE INDEX "race_months_month_key" ON "race_months"("month");

-- CreateIndex
CREATE UNIQUE INDEX "race_results_race_month_id_affiliate_id_key" ON "race_results"("race_month_id", "affiliate_id");

-- CreateIndex
CREATE INDEX "flags_status_idx" ON "flags"("status");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_documents" ADD CONSTRAINT "id_documents_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_edits" ADD CONSTRAINT "transaction_edits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_weeks" ADD CONSTRAINT "affiliate_weeks_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_weeks" ADD CONSTRAINT "affiliate_weeks_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_month_id_fkey" FOREIGN KEY ("race_month_id") REFERENCES "race_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Business-rule constraints (not expressible in Prisma) ----------

-- Two-person rule: nobody verifies their own entry.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_verifier_not_enterer"
  CHECK ("verified_by" IS NULL OR "verified_by" <> "entered_by");

-- Amounts are always positive; type says deposit or cashout.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive"
  CHECK ("amount_cents" > 0);

-- A verified entry must say who verified it; a rejected one must say why.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_verified_has_verifier"
  CHECK ("status" <> 'verified' OR ("verified_by" IS NOT NULL AND "verified_at" IS NOT NULL));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rejected_has_reason"
  CHECK ("status" <> 'rejected' OR "reject_reason" IS NOT NULL);

-- Carry-forward is a loss balance: zero or negative, never positive.
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_carry_forward_non_positive"
  CHECK ("carry_forward_cents" <= 0);
ALTER TABLE "affiliate_weeks" ADD CONSTRAINT "affiliate_weeks_carry_non_positive"
  CHECK ("carry_in_cents" <= 0 AND "carry_out_cents" <= 0 AND "commission_cents" >= 0);

-- Email and phone are unique across ALL affiliates and players. Payment handles may repeat (they get flagged).
CREATE UNIQUE INDEX "contact_registry_unique_email_phone"
  ON "contact_registry" ("kind", "value_normalized")
  WHERE "kind" <> 'payment_handle';

-- Add explicit seller acceptance and expiry tracking for transactions
ALTER TABLE "transactions"
ADD COLUMN "sellerAcceptedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3);

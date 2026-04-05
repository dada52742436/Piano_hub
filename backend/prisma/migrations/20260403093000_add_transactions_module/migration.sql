CREATE TYPE "TransactionStatus" AS ENUM (
  'initiated',
  'seller_accepted',
  'buyer_confirmed',
  'completed',
  'cancelled'
);

CREATE TABLE "transactions" (
  "id" SERIAL NOT NULL,
  "listingId" INTEGER NOT NULL,
  "buyerId" INTEGER NOT NULL,
  "offeredPrice" DOUBLE PRECISION NOT NULL,
  "message" TEXT,
  "status" "TransactionStatus" NOT NULL DEFAULT 'initiated',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transactions_listingId_buyerId_key" ON "transactions"("listingId", "buyerId");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_buyerId_fkey"
FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

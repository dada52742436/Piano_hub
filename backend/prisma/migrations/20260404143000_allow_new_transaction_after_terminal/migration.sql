DROP INDEX "transactions_listingId_buyerId_key";

CREATE INDEX "transactions_listingId_buyerId_idx" ON "transactions"("listingId", "buyerId");

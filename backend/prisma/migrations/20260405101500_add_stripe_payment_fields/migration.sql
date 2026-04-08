ALTER TABLE "payments"
ADD COLUMN "providerCheckoutSessionId" TEXT,
ADD COLUMN "checkoutUrl" TEXT;

CREATE INDEX "payments_providerCheckoutSessionId_idx" ON "payments"("providerCheckoutSessionId");
CREATE INDEX "payments_providerPaymentId_idx" ON "payments"("providerPaymentId");

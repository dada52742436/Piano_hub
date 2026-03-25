-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'sold', 'archived');

-- AlterTable
ALTER TABLE "listings"
ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'active';

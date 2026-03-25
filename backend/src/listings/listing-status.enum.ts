/**
 * Listing status enum for marketplace lifecycle state.
 *
 * This enum mirrors the `ListingStatus` enum in prisma/schema.prisma and must
 * stay in sync with the database schema.
 */
export enum ListingStatus {
  active = 'active',
  sold = 'sold',
  archived = 'archived',
}

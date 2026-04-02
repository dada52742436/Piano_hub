import { api } from './client';
import type { Listing } from './listings';

export interface SavedListingRecord {
  id: number;
  userId: number;
  listingId: number;
  createdAt: string;
  listing: Listing;
}

export async function saveListing(listingId: number): Promise<SavedListingRecord> {
  const { data } = await api.post<SavedListingRecord>(`/saved-listings/${listingId}`);
  return data;
}

export async function getMySavedListings(): Promise<SavedListingRecord[]> {
  const { data } = await api.get<SavedListingRecord[]>('/saved-listings/mine');
  return data;
}

export async function removeSavedListing(listingId: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/saved-listings/${listingId}`);
  return data;
}

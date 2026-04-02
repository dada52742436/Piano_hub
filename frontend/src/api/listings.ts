import { api } from './client';
import { type ListingCondition } from '../constants/conditions';
import { type ListingStatus } from '../constants/listingStatus';

export type { ListingCondition };

export interface ListingImage {
  id: number;
  listingId: number;
  url: string;
  order: number;
  createdAt: string;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  price: number;
  brand: string | null;
  condition: string;
  status: ListingStatus;
  location: string | null;
  ownerId: number;
  owner: {
    id: number;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
}

export interface CreateListingPayload {
  title: string;
  description: string;
  price: number;
  brand?: string;
  condition: ListingCondition;
  location?: string;
}

export interface UpdateListingPayload {
  title?: string;
  description?: string;
  price?: number;
  brand?: string;
  condition?: ListingCondition;
  status?: ListingStatus;
  location?: string;
}

export interface GetListingsParams {
  search?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedListings {
  data: Listing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAllListings(params?: GetListingsParams): Promise<PaginatedListings> {
  const { data } = await api.get<PaginatedListings>('/listings', { params });
  return data;
}

export async function getMyListings(): Promise<Listing[]> {
  const { data } = await api.get<Listing[]>('/listings/mine');
  return data;
}

export async function getListingById(id: number): Promise<Listing> {
  const { data } = await api.get<Listing>(`/listings/${id}`);
  return data;
}

export async function createListing(payload: CreateListingPayload): Promise<Listing> {
  const { data } = await api.post<Listing>('/listings', payload);
  return data;
}

export async function updateListing(id: number, payload: UpdateListingPayload): Promise<Listing> {
  const { data } = await api.patch<Listing>(`/listings/${id}`, payload);
  return data;
}

export async function deleteListing(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/listings/${id}`);
  return data;
}

export async function uploadListingImage(listingId: number, file: File): Promise<ListingImage> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post<ListingImage>(
    `/listings/${listingId}/images`,
    formData,
    { headers: { 'Content-Type': undefined } },
  );

  return data;
}

export async function deleteListingImage(
  listingId: number,
  imageId: number,
): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(
    `/listings/${listingId}/images/${imageId}`,
  );
  return data;
}

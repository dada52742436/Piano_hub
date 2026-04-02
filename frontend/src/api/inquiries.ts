import { api } from './client';
import type { Listing } from './listings';

export type InquiryStatus = 'open' | 'closed';

export interface Inquiry {
  id: number;
  listingId: number;
  requesterId: number;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  listing?: Partial<Listing> & {
    id: number;
    title: string;
    owner?: {
      id: number;
      username: string;
    };
  };
  requester?: {
    id: number;
    username: string;
  };
}

export async function createInquiry(listingId: number, message: string): Promise<Inquiry> {
  const { data } = await api.post<Inquiry>(`/listings/${listingId}/inquiries`, {
    message,
  });
  return data;
}

export async function getMyInquiries(): Promise<Inquiry[]> {
  const { data } = await api.get<Inquiry[]>('/inquiries/mine');
  return data;
}

export async function getListingInquiries(listingId: number): Promise<Inquiry[]> {
  const { data } = await api.get<Inquiry[]>(`/listings/${listingId}/inquiries`);
  return data;
}

export async function updateInquiryStatus(
  id: number,
  status: InquiryStatus,
): Promise<Inquiry> {
  const { data } = await api.patch<Inquiry>(`/inquiries/${id}/status`, {
    status,
  });
  return data;
}

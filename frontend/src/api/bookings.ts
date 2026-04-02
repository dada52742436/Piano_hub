import { api } from './client';

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface Booking {
  id: number;
  listingId: number;
  buyerId: number;
  status: BookingStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: {
    id: number;
    title: string;
    price?: number;
    location?: string | null;
  };
  buyer?: {
    id: number;
    username: string;
  };
}

export async function createBooking(
  listingId: number,
  message?: string,
): Promise<Booking> {
  const { data } = await api.post<Booking>(`/listings/${listingId}/bookings`, {
    message,
  });
  return data;
}

export async function getMyBookings(): Promise<Booking[]> {
  const { data } = await api.get<Booking[]>('/bookings/mine');
  return data;
}

export async function getListingBookings(listingId: number): Promise<Booking[]> {
  const { data } = await api.get<Booking[]>(`/listings/${listingId}/bookings`);
  return data;
}

export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${id}/status`, {
    status,
  });
  return data;
}

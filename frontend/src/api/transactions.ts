import { api } from './client';
import type { Listing } from './listings';

export type TransactionStatus =
  | 'initiated'
  | 'seller_accepted'
  | 'buyer_confirmed'
  | 'completed'
  | 'cancelled';

export interface Transaction {
  id: number;
  listingId: number;
  buyerId: number;
  offeredPrice: number;
  message: string | null;
  status: TransactionStatus;
  sellerAcceptedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing?: Partial<Listing> & {
    id: number;
    title: string;
    price?: number;
    location?: string | null;
    status?: string;
    owner?: {
      id: number;
      username: string;
    };
  };
  buyer?: {
    id: number;
    username: string;
  };
}

export async function createTransaction(
  listingId: number,
  payload: {
    offeredPrice: number;
    message?: string;
  },
): Promise<Transaction> {
  const { data } = await api.post<Transaction>(`/listings/${listingId}/transactions`, payload);
  return data;
}

export async function getMyTransactions(): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>('/transactions/mine');
  return data;
}

export async function getListingTransactions(listingId: number): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>(`/listings/${listingId}/transactions`);
  return data;
}

export async function updateTransactionStatus(
  id: number,
  status: TransactionStatus,
): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}/status`, {
    status,
  });
  return data;
}

export async function issueSellerRefund(id: number): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}/refund`);
  return data;
}

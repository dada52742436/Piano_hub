import { api } from './client';
import type { Transaction } from './transactions';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface Payment {
  id: number;
  transactionId: number;
  buyerId: number;
  amount: number;
  provider: string;
  providerCheckoutSessionId: string | null;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  transaction?: {
    id: number;
    status: Transaction['status'];
    listing?: {
      id: number;
      title: string;
      status?: string;
      owner?: {
        id: number;
        username: string;
      };
    };
  };
}

export async function createPayment(
  transactionId: number,
  payload: { amount: number; providerPaymentId?: string },
): Promise<Payment> {
  const { data } = await api.post<Payment>(`/transactions/${transactionId}/payments`, payload);
  return data;
}

export async function createStripeCheckoutSession(transactionId: number): Promise<Payment> {
  const { data } = await api.post<Payment>(
    `/transactions/${transactionId}/payments/checkout-session`,
  );
  return data;
}

export async function getMyPayments(): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>('/payments/mine');
  return data;
}

export async function getTransactionPayments(transactionId: number): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>(`/transactions/${transactionId}/payments`);
  return data;
}

export async function simulatePaymentStatus(
  paymentId: number,
  status: Exclude<PaymentStatus, 'pending'>,
): Promise<Payment> {
  const { data } = await api.patch<Payment>(`/payments/${paymentId}/simulate`, { status });
  return data;
}

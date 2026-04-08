import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPayment,
  createStripeCheckoutSession,
  getMyPayments,
  simulatePaymentStatus,
  type Payment,
  type PaymentStatus,
} from '../api/payments';
import {
  getMyTransactions,
  updateTransactionStatus,
  type Transaction,
  type TransactionStatus,
} from '../api/transactions';
import {
  sharedPageHeadingStyle,
  sharedPageHeaderStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  initiated: 'Initiated',
  seller_accepted: 'Seller Accepted',
  buyer_confirmed: 'Buyer Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment Pending',
  paid: 'Payment Paid',
  failed: 'Payment Failed',
  cancelled: 'Payment Cancelled',
  refunded: 'Payment Refunded',
};

function statusStyle(status: TransactionStatus): React.CSSProperties {
  const map: Record<TransactionStatus, React.CSSProperties> = {
    initiated: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
    seller_accepted: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
    buyer_confirmed: { background: '#ecfeff', color: '#0f766e', border: '1px solid #a5f3fc' },
    completed: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
    cancelled: { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
  };

  return { ...styles.badge, ...map[status] };
}

function paymentStatusStyle(status: PaymentStatus): React.CSSProperties {
  const map: Record<PaymentStatus, React.CSSProperties> = {
    pending: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
    paid: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
    failed: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
    cancelled: { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
    refunded: { background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
  };

  return { ...styles.badge, ...map[status] };
}

function formatRemainingTime(expiresAt: string, currentTime: number): string {
  const remainingMs = new Date(expiresAt).getTime() - currentTime;

  if (remainingMs <= 0) {
    return 'Awaiting automatic release...';
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

function buildTransactionNotice(
  transaction: Transaction,
  currentTime: number,
  payment?: Payment,
): { tone: 'neutral' | 'warning' | 'muted'; text: string } | null {
  // Payment is done but buyer hasn't confirmed yet — prompt them to confirm so the seller can complete.
  if (transaction.status === 'seller_accepted' && payment?.status === 'paid') {
    return {
      tone: 'warning',
      text: 'Your payment is confirmed. Click Confirm below to lock in the deal so the seller can complete the transaction.',
    };
  }

  if (transaction.status === 'seller_accepted' && transaction.expiresAt) {
    return {
      tone: 'warning',
      text: `Waiting for your next step. If you do not confirm in time, the seller can be released. ${formatRemainingTime(transaction.expiresAt, currentTime)}`,
    };
  }

  if (transaction.status === 'buyer_confirmed') {
    return {
      tone: 'neutral',
      text: 'You confirmed the deal. The seller can now complete or cancel the transaction.',
    };
  }

  if (transaction.status === 'cancelled' && transaction.sellerAcceptedAt) {
    if (transaction.listing?.status === 'sold') {
      return {
        tone: 'muted',
        text: 'This deal was closed because the listing has already been sold through another completed transaction.',
      };
    }

    return {
      tone: 'muted',
      text: 'This transaction was released after the accepted deal flow stopped moving forward.',
    };
  }

  if (transaction.status === 'cancelled' && transaction.listing?.status === 'sold') {
    return {
      tone: 'muted',
      text: 'This listing has already been sold, so your competing transaction is no longer active.',
    };
  }

  if (transaction.status === 'completed') {
    return {
      tone: 'neutral',
      text: 'This deal has been completed and the listing should now be marked as sold.',
    };
  }

  return null;
}

function buildPaymentNotice(
  payment: Payment | undefined,
): { tone: 'neutral' | 'warning' | 'muted'; text: string } | null {
  if (!payment) {
    return null;
  }

  if (payment.status === 'pending') {
    if (payment.provider === 'stripe') {
      return {
        tone: 'warning',
        text: 'Stripe checkout is still pending. Complete payment in Stripe before the seller can finalize this deal.',
      };
    }

    return {
      tone: 'warning',
      text: 'This payment is still pending. Mark it as paid to unlock final completion on the seller side.',
    };
  }

  if (payment.status === 'paid') {
    return {
      tone: 'neutral',
      text: 'Payment is marked as paid. Once the seller is ready, they can now complete the transaction.',
    };
  }

  if (payment.status === 'failed') {
    return {
      tone: 'muted',
      text: 'This payment attempt failed. You can create a new payment attempt for the same transaction.',
    };
  }

  if (payment.status === 'refunded') {
    return {
      tone: 'muted',
      text: 'Your payment has been refunded by Stripe. The funds should appear in your account within 5–10 business days.',
    };
  }

  return {
    tone: 'muted',
    text: 'This payment attempt was cancelled. Create a new payment attempt if you still want to continue the deal.',
  };
}

export function MyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentsByTransaction, setPaymentsByTransaction] = useState<Record<number, Payment | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    Promise.all([getMyTransactions(), getMyPayments()])
      .then(([loadedTransactions, payments]) => {
        setTransactions(loadedTransactions);

        const latestPayments = payments.reduce<Record<number, Payment>>((acc, payment) => {
          const existing = acc[payment.transactionId];
          if (!existing || new Date(existing.createdAt).getTime() < new Date(payment.createdAt).getTime()) {
            acc[payment.transactionId] = payment;
          }
          return acc;
        }, {});

        setPaymentsByTransaction(latestPayments);
      })
      .catch(() => setError('Failed to load your transactions.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleStatusChange(
    id: number,
    status: Extract<TransactionStatus, 'buyer_confirmed' | 'cancelled'>,
  ) {
    const label = status === 'buyer_confirmed' ? 'Confirm' : 'Cancel';
    if (!window.confirm(`${label} this transaction?`)) return;

    try {
      const updated = await updateTransactionStatus(id, status);
      setTransactions((prev) =>
        prev.map((transaction) => (transaction.id === updated.id ? updated : transaction)),
      );
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? 'Failed to update transaction status. Please try again.');
    }
  }

  async function handleCreatePayment(transaction: Transaction) {
    try {
      const payment = await createPayment(transaction.id, {
        amount: transaction.offeredPrice,
      });

      setPaymentsByTransaction((prev) => ({
        ...prev,
        [transaction.id]: payment,
      }));
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? 'Failed to create a payment attempt. Please try again.');
    }
  }

  async function handleStripeCheckout(transactionId: number) {
    try {
      const payment = await createStripeCheckoutSession(transactionId);

      setPaymentsByTransaction((prev) => ({
        ...prev,
        [transactionId]: payment,
      }));

      if (!payment.checkoutUrl) {
        setError('Stripe checkout URL was not returned. Please try again.');
        return;
      }

      window.location.assign(payment.checkoutUrl);
    } catch (err) {
      // Extract the actual backend error message so we can see what went wrong.
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : undefined;
      setError(message ?? 'Failed to start Stripe checkout. Please try again.');
    }
  }

  async function handleSimulatePayment(
    paymentId: number,
    transactionId: number,
    status: Exclude<PaymentStatus, 'pending'>,
  ) {
    const label = status === 'paid' ? 'Mark as paid' : status === 'failed' ? 'Mark as failed' : 'Cancel payment';
    if (!window.confirm(`${label}?`)) return;

    try {
      const updated = await simulatePaymentStatus(paymentId, status);
      setPaymentsByTransaction((prev) => ({
        ...prev,
        [transactionId]: updated,
      }));
    } catch {
      setError('Failed to update payment status. Please try again.');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link to="/listings" style={styles.back}>Back to Listings</Link>
          <h2 style={styles.heading}>My Transactions</h2>
          <p style={styles.subheading}>
            Track the deal flow for listings you are actively trying to purchase.
          </p>
        </div>
      </div>

      {loading && <p style={styles.info}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && transactions.length === 0 && (
        <div style={styles.emptyBox}>
          <p style={{ margin: '0 0 12px', color: '#6b7280' }}>
            You have not started any transactions yet.
          </p>
          <Link to="/listings" style={styles.btnBrowse}>
            Browse Listings
          </Link>
        </div>
      )}

      <div style={styles.list}>
        {transactions.map((transaction) => {
          const payment = paymentsByTransaction[transaction.id];
          const notice = buildTransactionNotice(transaction, currentTime, payment);
          const paymentNotice = buildPaymentNotice(payment);

          return (
            <div key={transaction.id} style={styles.row}>
              <div style={styles.rowMain}>
                <div style={styles.rowTop}>
                  <span style={statusStyle(transaction.status)}>
                    {STATUS_LABELS[transaction.status]}
                  </span>
                  {transaction.listing ? (
                    <Link
                      to={`/listings/${transaction.listing.id}`}
                      style={styles.rowTitle}
                    >
                      {transaction.listing.title}
                    </Link>
                  ) : (
                    <span style={styles.rowTitle}>Listing #{transaction.listingId}</span>
                  )}
                  {payment && (
                    <span style={paymentStatusStyle(payment.status)}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </span>
                  )}
                </div>

                <span style={styles.rowMeta}>
                  Offer: ${transaction.offeredPrice.toLocaleString()}
                  {transaction.listing?.owner?.username
                    ? ` - seller ${transaction.listing.owner.username}`
                    : ''}
                </span>

                {transaction.message && (
                  <p style={styles.message}>"{transaction.message}"</p>
                )}

                {payment && (
                  <p style={styles.paymentMeta}>
                    Latest payment attempt: ${payment.amount.toLocaleString()}
                    {payment.paidAt
                      ? ` - paid ${new Date(payment.paidAt).toLocaleDateString('en-AU')}`
                      : ''}
                  </p>
                )}

                {paymentNotice && (
                  <div
                    style={{
                      ...styles.notice,
                      ...(paymentNotice.tone === 'warning'
                        ? styles.noticeWarning
                        : paymentNotice.tone === 'muted'
                          ? styles.noticeMuted
                          : styles.noticeNeutral),
                    }}
                  >
                    {paymentNotice.text}
                  </div>
                )}

                {notice && (
                  <div
                    style={{
                      ...styles.notice,
                      ...(notice.tone === 'warning'
                        ? styles.noticeWarning
                        : notice.tone === 'muted'
                          ? styles.noticeMuted
                          : styles.noticeNeutral),
                    }}
                  >
                    {notice.text}
                  </div>
                )}

                <span style={styles.rowDate}>
                  Updated {new Date(transaction.updatedAt).toLocaleDateString('en-AU')}
                </span>
              </div>

              <div style={styles.rowActions}>
                {(!payment ||
                  payment.status === 'failed' ||
                  payment.status === 'cancelled') &&
                  (transaction.status === 'seller_accepted' ||
                    transaction.status === 'buyer_confirmed') && (
                    <>
                      <button
                        style={styles.btnStripe}
                        onClick={() => void handleStripeCheckout(transaction.id)}
                      >
                        {payment ? 'Pay with Stripe Again' : 'Pay with Stripe'}
                      </button>
                      <button
                        style={styles.btnPay}
                        onClick={() => void handleCreatePayment(transaction)}
                      >
                        {payment ? 'Create Simulated Payment' : 'Dev: Simulate Payment'}
                      </button>
                    </>
                  )}

                {payment?.provider === 'stripe' &&
                  payment.status === 'pending' &&
                  payment.checkoutUrl && (
                    <>
                      <button
                        style={styles.btnStripe}
                        onClick={() => window.location.assign(payment.checkoutUrl as string)}
                      >
                        Resume Stripe Checkout
                      </button>
                      {/* Allow cancelling a stale/expired Stripe session so a new one can be created. */}
                      <button
                        style={styles.btnCancel}
                        onClick={() => void handleSimulatePayment(payment.id, transaction.id, 'cancelled')}
                      >
                        Cancel expired session
                      </button>
                    </>
                  )}

                {payment?.provider !== 'stripe' && payment?.status === 'pending' && (
                  <>
                    <button
                      style={styles.btnPaySuccess}
                      onClick={() => void handleSimulatePayment(payment.id, transaction.id, 'paid')}
                    >
                      Simulate Paid
                    </button>
                    <button
                      style={styles.btnPayWarn}
                      onClick={() => void handleSimulatePayment(payment.id, transaction.id, 'failed')}
                    >
                      Simulate Failed
                    </button>
                    <button
                      style={styles.btnCancel}
                      onClick={() => void handleSimulatePayment(payment.id, transaction.id, 'cancelled')}
                    >
                      Cancel Payment
                    </button>
                  </>
                )}

                {transaction.status === 'seller_accepted' && (
                  <button
                    style={styles.btnConfirm}
                    onClick={() => void handleStatusChange(transaction.id, 'buyer_confirmed')}
                  >
                    Confirm
                  </button>
                )}

                {(transaction.status === 'initiated' ||
                  transaction.status === 'seller_accepted' ||
                  transaction.status === 'buyer_confirmed') && (
                  <button
                    style={styles.btnCancel}
                    onClick={() => void handleStatusChange(transaction.id, 'cancelled')}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: sharedPageStyle,
  header: sharedPageHeaderStyle,
  back: { display: 'block', color: '#2563eb', textDecoration: 'none', fontSize: 13, marginBottom: 6 },
  heading: sharedPageHeadingStyle,
  subheading: sharedPageSubheadingStyle,
  info: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  error: { color: '#dc2626', marginTop: 12 },
  emptyBox: { textAlign: 'center', marginTop: 60 },
  btnBrowse: {
    display: 'inline-block',
    padding: '8px 18px',
    background: '#2563eb',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    gap: 16,
  },
  rowMain: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  rowTop: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  badge: { fontSize: 12, padding: '2px 9px', borderRadius: 4, fontWeight: 500, flexShrink: 0 },
  rowTitle: { fontWeight: 600, fontSize: 15, color: '#111827', textDecoration: 'none' },
  rowMeta: { fontSize: 13, color: '#6b7280' },
  message: { margin: 0, fontSize: 13, color: '#374151', fontStyle: 'italic' },
  paymentMeta: { margin: 0, fontSize: 12, color: '#475569' },
  notice: {
    marginTop: 2,
    padding: '8px 10px',
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.45,
  },
  noticeNeutral: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
  },
  noticeWarning: {
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
  noticeMuted: {
    background: '#f9fafb',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
  },
  rowDate: { fontSize: 12, color: '#9ca3af' },
  rowActions: { display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' },
  btnConfirm: {
    padding: '5px 14px',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPay: {
    padding: '5px 14px',
    background: '#f5f3ff',
    color: '#7c3aed',
    border: '1px solid #ddd6fe',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnStripe: {
    padding: '5px 14px',
    background: '#111827',
    color: '#fff',
    border: '1px solid #111827',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPaySuccess: {
    padding: '5px 14px',
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPayWarn: {
    padding: '5px 14px',
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '5px 14px',
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
};

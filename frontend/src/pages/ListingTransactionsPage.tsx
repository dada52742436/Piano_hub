import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getListingById, type Listing } from '../api/listings';
import { getTransactionPayments, type Payment, type PaymentStatus } from '../api/payments';
import {
  getListingTransactions,
  issueSellerRefund,
  updateTransactionStatus,
  type Transaction,
  type TransactionStatus,
} from '../api/transactions';
import {
  sharedBackLinkStyle,
  sharedPageHeadingStyle,
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

function buildSellerNotice(
  transaction: Transaction,
  currentTime: number,
): { tone: 'neutral' | 'warning' | 'muted'; text: string } | null {
  if (transaction.status === 'seller_accepted' && transaction.expiresAt) {
    return {
      tone: 'warning',
      text: `This deal is waiting on the buyer. If they do not confirm in time, it will be released automatically. ${formatRemainingTime(transaction.expiresAt, currentTime)}`,
    };
  }

  if (transaction.status === 'buyer_confirmed') {
    return {
      tone: 'neutral',
      text: 'The buyer confirmed the deal. You can now complete the sale. If you cannot fulfil the order after payment, use "Issue Refund" instead of Cancel.',
    };
  }

  if (transaction.status === 'cancelled' && transaction.sellerAcceptedAt) {
    return {
      tone: 'muted',
      text: 'This accepted deal flow was released after it stopped moving forward.',
    };
  }

  if (transaction.status === 'completed') {
    return {
      tone: 'neutral',
      text: 'This transaction is complete. The listing should now remain sold, and other open deal flows on this listing have been closed automatically.',
    };
  }

  if (transaction.status === 'cancelled' && transaction.listing?.status === 'sold') {
    return {
      tone: 'muted',
      text: 'This competing transaction was closed automatically after another buyer completed the deal.',
    };
  }

  return null;
}

function buildPaymentNotice(
  payment: Payment | undefined,
  transaction: Transaction,
): { tone: 'neutral' | 'warning' | 'muted'; text: string } | null {
  if (!payment) {
    if (transaction.status === 'buyer_confirmed') {
      return {
        tone: 'warning',
        text: 'The buyer confirmed the deal, but there is still no payment record yet. Completion should wait until payment is marked as paid.',
      };
    }

    return null;
  }

  if (payment.status === 'pending') {
    return {
      tone: 'warning',
      text: 'Payment is still pending. Do not complete the transaction until it is marked as paid.',
    };
  }

  if (payment.status === 'paid') {
    return {
      tone: 'neutral',
      text: 'Payment is marked as paid. This transaction is ready for completion. If you cannot fulfil the order, use "Issue Refund" to return the buyer\'s payment.',
    };
  }

  if (payment.status === 'refunded') {
    return {
      tone: 'muted',
      text: 'The payment has been refunded. The transaction has been cancelled.',
    };
  }

  if (payment.status === 'failed') {
    return {
      tone: 'muted',
      text: 'The latest payment attempt failed. The buyer will need to create a new payment attempt before this deal can finish.',
    };
  }

  return {
    tone: 'muted',
    text: 'The latest payment attempt was cancelled. Wait for a new payment attempt before completing the sale.',
  };
}

export function ListingTransactionsPage() {
  const { id } = useParams<{ id: string }>();

  const [listing, setListing] = useState<Listing | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentsByTransaction, setPaymentsByTransaction] = useState<Record<number, Payment | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!id) return;
    const listingId = Number(id);

    Promise.all([getListingById(listingId), getListingTransactions(listingId)])
      .then(async ([loadedListing, loadedTransactions]) => {
        setListing(loadedListing);
        setTransactions(loadedTransactions);

        const paymentGroups = await Promise.all(
          loadedTransactions.map(async (transaction) => {
            const payments = await getTransactionPayments(transaction.id);
            const latest = payments.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )[0];
            return [transaction.id, latest] as const;
          }),
        );

        setPaymentsByTransaction(
          Object.fromEntries(paymentGroups.filter((entry) => entry[1] !== undefined)),
        );
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setError('You do not own this listing.');
        } else if (status === 404) {
          setError('Listing not found.');
        } else {
          setError('Failed to load transactions.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleStatusChange(
    id: number,
    status: Extract<TransactionStatus, 'seller_accepted' | 'completed' | 'cancelled'>,
  ) {
    const label =
      status === 'seller_accepted'
        ? 'Accept'
        : status === 'completed'
          ? 'Complete'
          : 'Cancel';

    if (!window.confirm(`${label} this transaction?`)) return;

    try {
      const updated = await updateTransactionStatus(id, status);
      setTransactions((prev) =>
        prev.map((transaction) => (transaction.id === updated.id ? updated : transaction)),
      );

      if (status === 'completed') {
        setListing((prev) => (prev ? { ...prev, status: 'sold' } : prev));
      }
    } catch {
      setError('Failed to update transaction status. Please try again.');
    }
  }

  async function handleSellerRefund(id: number) {
    if (!window.confirm('Issue a refund and cancel this transaction? This will return the buyer\'s payment via Stripe.')) return;

    try {
      const updated = await issueSellerRefund(id);
      setTransactions((prev) =>
        prev.map((transaction) => (transaction.id === updated.id ? updated : transaction)),
      );
    } catch {
      setError('Failed to issue refund. Please try again.');
    }
  }

  if (loading) return <p style={styles.info}>Loading...</p>;
  if (error && !listing) return <p style={styles.error}>{error}</p>;

  return (
    <div style={styles.page}>
      <Link to={`/listings/${id}`} style={styles.back}>Back to Listing</Link>

      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>Transaction Requests</h2>
          {listing ? (
            <p style={styles.subheading}>{listing.title}</p>
          ) : (
            <p style={styles.subheading}>Review buyers who are ready to move into a deal flow.</p>
          )}
        </div>
      </div>

      {listing?.status === 'sold' && (
        <div style={styles.pageNotice}>
          This listing is sold. Completed transactions lock the listing and automatically close other open transactions, bookings, and inquiries.
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      {!error && transactions.length === 0 && (
        <div style={styles.emptyBox}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            No transaction requests yet for this listing.
          </p>
        </div>
      )}

      <div style={styles.list}>
        {transactions.map((transaction) => {
          const notice = buildSellerNotice(transaction, currentTime);
          const payment = paymentsByTransaction[transaction.id];
          const paymentNotice = buildPaymentNotice(payment, transaction);

          return (
            <div key={transaction.id} style={styles.row}>
              <div style={styles.rowMain}>
                <div style={styles.rowTop}>
                  <span style={statusStyle(transaction.status)}>
                    {STATUS_LABELS[transaction.status]}
                  </span>
                  <span style={styles.buyerName}>
                    {transaction.buyer?.username ?? `User #${transaction.buyerId}`}
                  </span>
                  {payment && (
                    <span style={paymentStatusStyle(payment.status)}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </span>
                  )}
                </div>

                <span style={styles.rowMeta}>
                  Offer: ${transaction.offeredPrice.toLocaleString()}
                </span>

                {transaction.message && (
                  <p style={styles.message}>"{transaction.message}"</p>
                )}

                {payment && (
                  <p style={styles.paymentMeta}>
                    Latest payment attempt: ${payment.amount.toLocaleString()}
                    {payment.status === 'paid' && payment.paidAt
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
                {transaction.status === 'initiated' && (
                  <button
                    style={styles.btnAccept}
                    onClick={() => void handleStatusChange(transaction.id, 'seller_accepted')}
                  >
                    Accept
                  </button>
                )}

                {transaction.status === 'buyer_confirmed' && (
                  <button
                    style={styles.btnComplete}
                    onClick={() => void handleStatusChange(transaction.id, 'completed')}
                  >
                    Complete
                  </button>
                )}

                {(transaction.status === 'initiated' ||
                  transaction.status === 'seller_accepted' ||
                  transaction.status === 'buyer_confirmed') && (
                  payment?.status === 'paid' ? (
                    <button
                      style={styles.btnRefund}
                      onClick={() => void handleSellerRefund(transaction.id)}
                    >
                      Issue Refund
                    </button>
                  ) : (
                    <button
                      style={styles.btnCancel}
                      onClick={() => void handleStatusChange(transaction.id, 'cancelled')}
                    >
                      Cancel
                    </button>
                  )
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
  back: sharedBackLinkStyle,
  header: { marginBottom: 24 },
  heading: { ...sharedPageHeadingStyle, margin: '0 0 4px' },
  subheading: { ...sharedPageSubheadingStyle, marginTop: 0 },
  info: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  error: { color: '#dc2626', marginTop: 12 },
  pageNotice: {
    marginBottom: 16,
    padding: '10px 12px',
    borderRadius: 8,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontSize: 13,
    lineHeight: 1.5,
  },
  emptyBox: { textAlign: 'center', marginTop: 60 },
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
  buyerName: { fontWeight: 600, fontSize: 15, color: '#111827' },
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
  btnAccept: {
    padding: '5px 14px',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnComplete: {
    padding: '5px 14px',
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
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
  btnRefund: {
    padding: '5px 14px',
    background: '#faf5ff',
    color: '#7e22ce',
    border: '1px solid #e9d5ff',
    borderRadius: 5,
    fontSize: 13,
    cursor: 'pointer',
  },
};

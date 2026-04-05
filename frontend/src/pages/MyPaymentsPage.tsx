import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPayments, type Payment, type PaymentStatus } from '../api/payments';
import {
  sharedPageHeadingStyle,
  sharedPageHeaderStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function statusStyle(status: PaymentStatus): React.CSSProperties {
  const map: Record<PaymentStatus, React.CSSProperties> = {
    pending: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
    paid: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
    failed: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' },
    cancelled: { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
  };

  return { ...styles.badge, ...map[status] };
}

export function MyPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyPayments()
      .then(setPayments)
      .catch(() => setError('Failed to load your payments.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link to="/transactions/mine" style={styles.back}>Back to My Transactions</Link>
          <h2 style={styles.heading}>My Payments</h2>
          <p style={styles.subheading}>
            Review simulated payment attempts linked to your active deal flow.
          </p>
        </div>
      </div>

      {loading && <p style={styles.info}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && payments.length === 0 && (
        <div style={styles.emptyBox}>
          <p style={{ margin: '0 0 12px', color: '#6b7280' }}>
            You do not have any payment attempts yet.
          </p>
          <Link to="/transactions/mine" style={styles.btnBrowse}>
            Review My Transactions
          </Link>
        </div>
      )}

      <div style={styles.list}>
        {payments.map((payment) => (
          <div key={payment.id} style={styles.row}>
            <div style={styles.rowMain}>
              <div style={styles.rowTop}>
                <span style={statusStyle(payment.status)}>{STATUS_LABELS[payment.status]}</span>
                {payment.transaction?.listing ? (
                  <Link
                    to={`/listings/${payment.transaction.listing.id}`}
                    style={styles.rowTitle}
                  >
                    {payment.transaction.listing.title}
                  </Link>
                ) : (
                  <span style={styles.rowTitle}>Transaction #{payment.transactionId}</span>
                )}
              </div>

              <span style={styles.rowMeta}>
                Amount: ${payment.amount.toLocaleString()}
                {payment.transaction?.listing?.owner?.username
                  ? ` - seller ${payment.transaction.listing.owner.username}`
                  : ''}
              </span>

              <p
                style={{
                  ...styles.notice,
                  ...(payment.status === 'pending'
                    ? styles.noticeWarning
                    : payment.status === 'paid'
                      ? styles.noticeNeutral
                      : styles.noticeMuted),
                }}
              >
                {payment.status === 'pending'
                  ? 'This payment is still pending. Once it is marked as paid, the seller can complete the transaction.'
                  : payment.status === 'paid'
                    ? 'This payment is marked as paid. The seller can now finalize the transaction.'
                    : payment.status === 'failed'
                      ? 'This payment attempt failed. Return to My Transactions if you want to create a new payment attempt.'
                      : 'This payment attempt was cancelled. You can start another one from My Transactions if the deal is still active.'}
              </p>

              <span style={styles.rowDate}>
                Updated {new Date(payment.updatedAt).toLocaleDateString('en-AU')}
                {payment.paidAt ? ` - paid ${new Date(payment.paidAt).toLocaleDateString('en-AU')}` : ''}
              </span>
            </div>
          </div>
        ))}
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
  notice: {
    margin: 0,
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
};

import { Link, useSearchParams } from 'react-router-dom';
import {
  sharedPageHeadingStyle,
  sharedPageHeaderStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');
  const sessionId = searchParams.get('session_id');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>Payment Submitted</h2>
          <p style={styles.subheading}>
            Stripe returned successfully. Your payment still needs webhook confirmation before the seller can complete the deal.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <p style={styles.text}>
          If everything went through, this payment should soon appear as <strong>paid</strong> in My Payments and on the related transaction.
        </p>

        {transactionId && (
          <p style={styles.meta}>
            Transaction ID: {transactionId}
          </p>
        )}

        {sessionId && (
          <p style={styles.meta}>
            Checkout Session: {sessionId}
          </p>
        )}

        <div style={styles.actions}>
          <Link to="/payments/mine" style={styles.primaryLink}>
            Review My Payments
          </Link>
          <Link to="/transactions/mine" style={styles.secondaryLink}>
            Back to My Transactions
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: sharedPageStyle,
  header: sharedPageHeaderStyle,
  heading: sharedPageHeadingStyle,
  subheading: sharedPageSubheadingStyle,
  card: {
    padding: '20px',
    border: '1px solid #bbf7d0',
    borderRadius: 10,
    background: '#f0fdf4',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  text: {
    margin: 0,
    color: '#166534',
    lineHeight: 1.6,
  },
  meta: {
    margin: 0,
    color: '#15803d',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  primaryLink: {
    display: 'inline-block',
    padding: '8px 14px',
    background: '#166534',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
  secondaryLink: {
    display: 'inline-block',
    padding: '8px 14px',
    background: '#fff',
    color: '#166534',
    border: '1px solid #86efac',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
};

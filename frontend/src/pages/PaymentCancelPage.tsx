import { Link, useSearchParams } from 'react-router-dom';
import {
  sharedPageHeadingStyle,
  sharedPageHeaderStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

export function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const transactionId = searchParams.get('transactionId');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>Payment Cancelled</h2>
          <p style={styles.subheading}>
            Stripe checkout was cancelled. Your transaction can still continue if you restart payment from My Transactions.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <p style={styles.text}>
          No deal is completed yet. If you still want this piano, go back to the transaction and start Stripe checkout again.
        </p>

        {transactionId && (
          <p style={styles.meta}>
            Transaction ID: {transactionId}
          </p>
        )}

        <div style={styles.actions}>
          <Link to="/transactions/mine" style={styles.primaryLink}>
            Back to My Transactions
          </Link>
          <Link to="/payments/mine" style={styles.secondaryLink}>
            Review My Payments
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
    border: '1px solid #fed7aa',
    borderRadius: 10,
    background: '#fff7ed',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  text: {
    margin: 0,
    color: '#9a3412',
    lineHeight: 1.6,
  },
  meta: {
    margin: 0,
    color: '#c2410c',
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
    background: '#9a3412',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
  secondaryLink: {
    display: 'inline-block',
    padding: '8px 14px',
    background: '#fff',
    color: '#9a3412',
    border: '1px solid #fdba74',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
};

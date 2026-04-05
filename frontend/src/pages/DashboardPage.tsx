import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProfile } from '../api/auth';
import { getMyBookings, type Booking } from '../api/bookings';
import { getMyInquiries, type Inquiry } from '../api/inquiries';
import { getMyListings, type Listing } from '../api/listings';
import { getMyPayments, type Payment } from '../api/payments';
import { getMySavedListings, type SavedListingRecord } from '../api/savedListings';
import { useAuth } from '../context/AuthContext';
import {
  sharedPageHeadingStyle,
  sharedPageHeaderStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

interface ProfileData {
  message: string;
  user: {
    id: number;
    email: string;
    username: string;
    createdAt: string;
  };
}

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  archivedListings: number;
  savedListings: number;
  pendingBookings: number;
  acceptedBookings: number;
  openInquiries: number;
  closedInquiries: number;
  pendingPayments: number;
  paidPayments: number;
}

type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  date: string;
  link: string;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getProfile(),
      getMyListings(),
      getMySavedListings(),
      getMyBookings(),
      getMyInquiries(),
      getMyPayments(),
    ])
      .then(([profileData, listings, savedListings, bookings, inquiries, payments]) => {
        if (cancelled) return;

        setProfile(profileData);
        setStats(buildStats(listings, savedListings, bookings, inquiries, payments));
        setRecentActivity(buildRecentActivity(listings, savedListings, bookings, inquiries, payments));
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load your dashboard activity. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Welcome back, {user?.username}</h2>
          <p style={styles.subheading}>
            Keep track of your listings, saved items, bookings, and seller conversations from one place.
          </p>
        </div>
        <div style={styles.headerActions}>
          <Link to="/listings/new" style={styles.primaryBtn}>
            Post Listing
          </Link>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {loading && <p style={styles.info}>Loading...</p>}
      {error && <div style={styles.error}>{error}</div>}

      {!loading && !error && profile && stats && (
        <>
          <div style={styles.statsGrid}>
            <StatCard label="My Listings" value={stats.totalListings} hint={`${stats.activeListings} active`} />
            <StatCard label="Saved Listings" value={stats.savedListings} hint="Your shortlist" />
            <StatCard label="Pending Bookings" value={stats.pendingBookings} hint="Buyer-side requests" />
            <StatCard label="Open Inquiries" value={stats.openInquiries} hint="Buyer-side conversations" />
            <StatCard label="Pending Payments" value={stats.pendingPayments} hint={`${stats.paidPayments} paid`} />
          </div>

          <div style={styles.contentGrid}>
            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Needs Attention</h3>
              <div style={styles.alertList}>
                {stats.pendingBookings > 0 ? (
                  <Link to="/bookings/mine" style={styles.alertPrimary}>
                    You have {stats.pendingBookings} pending booking request
                    {stats.pendingBookings !== 1 ? 's' : ''} to follow up on.
                  </Link>
                ) : (
                  <div style={styles.alertMuted}>No pending booking actions on your buyer side right now.</div>
                )}

                {stats.openInquiries > 0 ? (
                  <Link to="/inquiries/mine" style={styles.alertPrimary}>
                    You have {stats.openInquiries} open inquir
                    {stats.openInquiries === 1 ? 'y' : 'ies'} still waiting for a reply or close-out.
                  </Link>
                ) : (
                  <div style={styles.alertMuted}>No open inquiries waiting on your buyer side.</div>
                )}

                {stats.activeListings === 0 ? (
                  <Link to="/listings/new" style={styles.alertSecondary}>
                    You do not have any active listings right now. Post one to re-enter the marketplace.
                  </Link>
                ) : (
                  <div style={styles.alertNeutral}>
                    Your marketplace presence is live with {stats.activeListings} active listing
                    {stats.activeListings !== 1 ? 's' : ''}.
                  </div>
                )}
              </div>
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Listing Snapshot</h3>
              <div style={styles.snapshotGrid}>
                <SnapshotPill label="Active" value={stats.activeListings} tone="blue" />
                <SnapshotPill label="Sold" value={stats.soldListings} tone="red" />
                <SnapshotPill label="Archived" value={stats.archivedListings} tone="neutral" />
              </div>
              <p style={styles.panelCopy}>
                Active listings stay visible in the public marketplace. Sold and archived listings stay in your
                account for management and record-keeping.
              </p>
              <Link to="/listings/mine" style={styles.panelLink}>
                Manage My Listings
              </Link>
            </section>
          </div>

          <div style={styles.contentGrid}>
            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Seller Workspace</h3>
              <div style={styles.workspaceList}>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Marketplace visibility</strong>
                  <span style={styles.workspaceValue}>
                    {stats.activeListings > 0
                      ? `${stats.activeListings} listing${stats.activeListings !== 1 ? 's' : ''} currently public`
                      : 'No active listings are public right now'}
                  </span>
                </div>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Inventory history</strong>
                  <span style={styles.workspaceValue}>
                    {stats.soldListings} sold and {stats.archivedListings} archived listing
                    {stats.soldListings + stats.archivedListings !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Suggested next step</strong>
                  <span style={styles.workspaceValue}>
                    {stats.totalListings === 0
                      ? 'Create your first listing to start attracting buyers.'
                      : stats.activeListings === 0
                        ? 'Review an older listing and mark one as active if it is still available.'
                        : 'Keep your active listings updated so buyers see the latest condition and pricing.'}
                  </span>
                </div>
              </div>
              <div style={styles.quickLinks}>
                <Link to="/listings/new" style={styles.quickLink}>
                  Post Another Listing
                </Link>
                <Link to="/listings/mine" style={styles.quickLink}>
                  Open Seller Inventory
                </Link>
              </div>
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Buyer Workspace</h3>
              <div style={styles.workspaceList}>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Shortlist</strong>
                  <span style={styles.workspaceValue}>
                    {stats.savedListings > 0
                      ? `${stats.savedListings} listing${stats.savedListings !== 1 ? 's' : ''} saved for comparison`
                      : 'No saved listings yet'}
                  </span>
                </div>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Booking pipeline</strong>
                  <span style={styles.workspaceValue}>
                    {stats.pendingBookings} pending and {stats.acceptedBookings} accepted booking
                    {stats.pendingBookings + stats.acceptedBookings !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Inquiry pipeline</strong>
                  <span style={styles.workspaceValue}>
                    {stats.openInquiries} open and {stats.closedInquiries} closed inquir
                    {stats.closedInquiries === 1 ? 'y' : 'ies'}
                  </span>
                </div>
                <div style={styles.workspaceItem}>
                  <strong style={styles.workspaceLabel}>Payment pipeline</strong>
                  <span style={styles.workspaceValue}>
                    {stats.pendingPayments} pending and {stats.paidPayments} paid payment
                    {stats.pendingPayments + stats.paidPayments !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div style={styles.quickLinks}>
                <Link to="/saved-listings/mine" style={styles.quickLink}>
                  Review Saved Listings
                </Link>
                <Link to="/bookings/mine" style={styles.quickLink}>
                  Open Booking Pipeline
                </Link>
                <Link to="/inquiries/mine" style={styles.quickLink}>
                  Open Inquiry Pipeline
                </Link>
                <Link to="/payments/mine" style={styles.quickLink}>
                  Review Payment Attempts
                </Link>
              </div>
            </section>
          </div>

          <div style={styles.contentGrid}>
            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Recent Activity</h3>
              {recentActivity.length === 0 ? (
                <div style={styles.emptyState}>
                  <strong style={styles.emptyStateTitle}>Your dashboard is still quiet.</strong>
                  <p style={styles.panelCopy}>
                    Start by posting a listing, saving a piano, or reaching out to a seller. Activity will start
                    showing up here once you take those first steps.
                  </p>
                </div>
              ) : (
                <div style={styles.activityList}>
                  {recentActivity.map((item) => (
                    <Link key={item.id} to={item.link} style={styles.activityItem}>
                      <strong style={styles.activityTitle}>{item.title}</strong>
                      <span style={styles.activityMeta}>{item.meta}</span>
                      <span style={styles.activityDate}>{new Date(item.date).toLocaleDateString('en-AU')}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <h3 style={styles.panelTitle}>Quick Actions</h3>
              <div style={styles.quickLinks}>
                <Link to="/saved-listings/mine" style={styles.quickLink}>
                  Open Saved Listings
                </Link>
                <Link to="/bookings/mine" style={styles.quickLink}>
                  Review My Bookings
                </Link>
                <Link to="/inquiries/mine" style={styles.quickLink}>
                  Review My Inquiries
                </Link>
                <Link to="/payments/mine" style={styles.quickLink}>
                  Review My Payments
                </Link>
                <Link to="/listings" style={styles.quickLink}>
                  Browse Marketplace
                </Link>
              </div>
            </section>
          </div>

          <section style={styles.profilePanel}>
            <div style={styles.profileHeader}>
              <h3 style={styles.panelTitle}>Account Summary</h3>
              <span style={styles.profileBadge}>Protected profile access confirmed</span>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>User ID</span>
                <span>{profile.user.id}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Email</span>
                <span>{profile.user.email}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Username</span>
                <span>{profile.user.username}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Registered At</span>
                <span>{new Date(profile.user.createdAt).toLocaleString('en-AU')}</span>
              </div>
            </div>
            <p style={styles.profileMessage}>{profile.message}</p>
          </section>
        </>
      )}
    </div>
  );
}

function buildStats(
  listings: Listing[],
  savedListings: SavedListingRecord[],
  bookings: Booking[],
  inquiries: Inquiry[],
  payments: Payment[],
): DashboardStats {
  return {
    totalListings: listings.length,
    activeListings: listings.filter((item) => item.status === 'active').length,
    soldListings: listings.filter((item) => item.status === 'sold').length,
    archivedListings: listings.filter((item) => item.status === 'archived').length,
    savedListings: savedListings.length,
    pendingBookings: bookings.filter((item) => item.status === 'pending').length,
    acceptedBookings: bookings.filter((item) => item.status === 'accepted').length,
    openInquiries: inquiries.filter((item) => item.status === 'open').length,
    closedInquiries: inquiries.filter((item) => item.status === 'closed').length,
    pendingPayments: payments.filter((item) => item.status === 'pending').length,
    paidPayments: payments.filter((item) => item.status === 'paid').length,
  };
}

function buildRecentActivity(
  listings: Listing[],
  savedListings: SavedListingRecord[],
  bookings: Booking[],
  inquiries: Inquiry[],
  payments: Payment[],
): ActivityItem[] {
  const listingItems: ActivityItem[] = listings.map((item) => ({
    id: `listing-${item.id}`,
    title: item.title,
    meta: `Listing updated - ${item.status}`,
    date: item.updatedAt,
    link: `/listings/${item.id}`,
  }));

  const savedItems: ActivityItem[] = savedListings.map((item) => ({
    id: `saved-${item.id}`,
    title: item.listing.title,
    meta: 'Saved to shortlist',
    date: item.createdAt,
    link: '/saved-listings/mine',
  }));

  const bookingItems: ActivityItem[] = bookings.map((item) => ({
    id: `booking-${item.id}`,
    title: item.listing?.title ?? `Listing #${item.listingId}`,
    meta: `Booking ${item.status}`,
    date: item.updatedAt,
    link: '/bookings/mine',
  }));

  const inquiryItems: ActivityItem[] = inquiries.map((item) => ({
    id: `inquiry-${item.id}`,
    title: item.listing?.title ?? `Listing #${item.listingId}`,
    meta: `Inquiry ${item.status}`,
    date: item.updatedAt,
    link: '/inquiries/mine',
  }));

  const paymentItems: ActivityItem[] = payments.map((item) => ({
    id: `payment-${item.id}`,
    title: item.transaction?.listing?.title ?? `Transaction #${item.transactionId}`,
    meta: `Payment ${item.status}`,
    date: item.updatedAt,
    link: '/payments/mine',
  }));

  return [...listingItems, ...savedItems, ...bookingItems, ...inquiryItems, ...paymentItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
      <span style={styles.statHint}>{hint}</span>
    </div>
  );
}

function SnapshotPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'red' | 'neutral';
}) {
  const toneStyle =
    tone === 'blue'
      ? styles.snapshotBlue
      : tone === 'red'
        ? styles.snapshotRed
        : styles.snapshotNeutral;

  return (
    <div style={{ ...styles.snapshotPill, ...toneStyle }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { ...sharedPageStyle, maxWidth: 980 },
  header: sharedPageHeaderStyle,
  title: sharedPageHeadingStyle,
  subheading: sharedPageSubheadingStyle,
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primaryBtn: {
    padding: '8px 16px',
    background: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: 6,
    fontSize: 14,
    textDecoration: 'none',
    color: '#fff',
  },
  logoutBtn: {
    padding: '8px 16px',
    background: '#fff1f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    color: '#be123c',
  },
  info: { textAlign: 'center', marginTop: 60, color: '#6b7280' },
  error: {
    background: '#fff1f0',
    border: '1px solid #ffa39e',
    color: '#cf1322',
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 20,
    fontSize: 14,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '18px 18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statValue: {
    fontSize: 28,
    color: '#0f172a',
    lineHeight: 1.1,
  },
  statHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
    gap: 18,
    marginBottom: 24,
  },
  panel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 22,
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)',
  },
  panelTitle: {
    margin: '0 0 14px',
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  alertPrimary: {
    padding: '11px 12px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    textDecoration: 'none',
    fontSize: 14,
    lineHeight: 1.6,
  },
  alertSecondary: {
    padding: '11px 12px',
    borderRadius: 8,
    background: '#ecfeff',
    border: '1px solid #a5f3fc',
    color: '#0f766e',
    textDecoration: 'none',
    fontSize: 14,
    lineHeight: 1.6,
  },
  alertNeutral: {
    padding: '11px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: 14,
    lineHeight: 1.6,
  },
  alertMuted: {
    padding: '11px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.6,
  },
  snapshotGrid: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  snapshotPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    borderRadius: 999,
    border: '1px solid transparent',
    fontSize: 13,
  },
  snapshotBlue: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
  snapshotRed: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  snapshotNeutral: { background: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  panelCopy: {
    margin: '0 0 14px',
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 1.7,
  },
  panelLink: {
    color: '#2563eb',
    fontSize: 14,
    textDecoration: 'none',
    fontWeight: 600,
  },
  workspaceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  workspaceItem: {
    padding: '12px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  workspaceLabel: {
    color: '#0f172a',
    fontSize: 13,
  },
  workspaceValue: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 1.6,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  activityItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    textDecoration: 'none',
  },
  activityTitle: {
    color: '#0f172a',
    fontSize: 14,
  },
  activityMeta: {
    color: '#475569',
    fontSize: 13,
  },
  activityDate: {
    color: '#94a3b8',
    fontSize: 12,
  },
  emptyState: {
    padding: '14px 14px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  emptyStateTitle: {
    display: 'block',
    marginBottom: 8,
    color: '#0f172a',
    fontSize: 14,
  },
  quickLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  quickLink: {
    padding: '10px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    textDecoration: 'none',
    fontSize: 14,
  },
  profilePanel: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 24,
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)',
  },
  profileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  profileBadge: {
    background: '#f6ffed',
    border: '1px solid #b7eb8f',
    color: '#389e0d',
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 13,
  },
  infoBox: {
    background: '#fafafa',
    border: '1px solid #f0f0f0',
    borderRadius: 6,
    padding: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #f0f0f0',
    fontSize: 14,
    gap: 12,
  },
  infoLabel: { color: '#888', fontWeight: 500 },
  profileMessage: {
    marginTop: 16,
    color: '#555',
    fontSize: 14,
  },
};

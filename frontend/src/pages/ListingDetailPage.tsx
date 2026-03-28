import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getListingById,
  deleteListing,
  uploadListingImage,
  deleteListingImage,
  type Listing,
} from '../api/listings';
import { createBooking } from '../api/bookings';
import { useAuth } from '../context/AuthContext';
import { CONDITION_LABELS } from '../constants/conditions';
import { LISTING_STATUS_LABELS } from '../constants/listingStatus';

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Booking form state — only rendered for logged-in non-owners
  const [bookingMsg, setBookingMsg] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Image upload state — only used by the owner
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Fetch the listing when the component mounts or the id param changes
  useEffect(() => {
    if (!id) return;
    getListingById(Number(id))
      .then(setListing)
      .catch(() => setError('Listing not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  // True only when the current logged-in user is the owner of this listing
  const isOwner = user !== null && listing !== null && user.id === listing.ownerId;
  const canReceiveBookings = listing?.status === 'active';

  // Buyer submits a booking request for this listing
  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setBookingError('');
    setBookingSubmitting(true);
    try {
      await createBooking(listing.id, bookingMsg.trim() || undefined);
      setBookingSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setBookingError(
        Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to send booking request.'),
      );
    } finally {
      setBookingSubmitting(false);
    }
  }

  async function handleUpload(file: File) {
    if (!listing) return;
    setUploadError('');
    setUploading(true);
    try {
      const newImage = await uploadListingImage(listing.id, file);
      setListing((prev) => (prev ? { ...prev, images: [...prev.images, newImage] } : prev));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message;
      setUploadError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  }

  async function handleImageDelete(imageId: number) {
    if (!listing) return;
    try {
      await deleteListingImage(listing.id, imageId);
      setListing((prev) =>
        prev ? { ...prev, images: prev.images.filter((img) => img.id !== imageId) } : prev,
      );
    } catch {
      // keep the image in the list if the delete request failed
    }
  }

  async function handleDelete() {
    if (!listing) return;
    if (!window.confirm('Are you sure you want to delete this listing?')) return;

    setDeleting(true);
    try {
      await deleteListing(listing.id);
      // After deletion, go back to the listings index
      navigate('/listings');
    } catch {
      setError('Failed to delete. Please try again.');
      setDeleting(false);
    }
  }

  if (loading) return <p style={styles.info}>Loading...</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (!listing) return null;

  return (
    <div style={styles.page}>
      {/* Back link */}
      <Link to="/listings" style={styles.back}>← Back to Listings</Link>

      <div style={styles.card}>
        {/* Header: title + owner actions */}
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.badges}>
              <span style={styles.condition}>{CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
              <span
                style={{
                  ...styles.status,
                  ...(listing.status === 'active'
                    ? styles.statusActive
                    : listing.status === 'sold'
                      ? styles.statusSold
                      : styles.statusArchived),
                }}
              >
                {LISTING_STATUS_LABELS[listing.status]}
              </span>
              {listing.brand && <span style={styles.brand}>{listing.brand}</span>}
            </div>
            <h2 style={styles.title}>{listing.title}</h2>
            <p style={styles.price}>${listing.price.toLocaleString()}</p>
          </div>

          {/* Edit / Delete buttons — only visible to the owner */}
          {isOwner && (
            <div style={styles.ownerActions}>
              <Link to={`/listings/${listing.id}/edit`} style={styles.btnEdit}>
                Edit
              </Link>
              <button
                style={styles.btnDelete}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <hr style={styles.divider} />

        {/* Photos */}
        {(listing.images.length > 0 || isOwner) && (
          <section style={styles.section}>
            <h4 style={styles.sectionLabel}>Photos</h4>
            {listing.images.length > 0 && (
              <div style={styles.gallery}>
                {listing.images.map((img) => (
                  <div key={img.id} style={styles.galleryItem}>
                    <img src={img.url} alt={listing.title} style={styles.galleryImg} />
                    {isOwner && (
                      <button
                        style={styles.imgDeleteBtn}
                        onClick={() => void handleImageDelete(img.id)}
                        title="Remove photo"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isOwner && listing.images.length < 5 && (
              <div style={{ marginTop: listing.images.length > 0 ? 12 : 0 }}>
                <label style={uploading ? styles.uploadLabelDisabled : styles.uploadLabel}>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                      e.target.value = '';
                    }}
                    disabled={uploading}
                  />
                  {uploading ? 'Uploading…' : '+ Add Photo'}
                </label>
                {listing.images.length === 0 && !uploading && (
                  <p style={styles.noPhotosHint}>No photos yet. Add up to 5 photos.</p>
                )}
                {uploadError && <p style={styles.uploadError}>{uploadError}</p>}
              </div>
            )}
            {isOwner && listing.images.length >= 5 && (
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                Maximum 5 photos reached.
              </p>
            )}
          </section>
        )}

        {/* Description */}
        <section style={styles.section}>
          {isOwner && (
            <div
              style={{
                ...styles.ownerStatusNotice,
                ...(listing.status === 'active'
                  ? styles.ownerStatusNoticeActive
                  : listing.status === 'sold'
                    ? styles.ownerStatusNoticeSold
                    : styles.ownerStatusNoticeArchived),
              }}
            >
              {listing.status === 'active'
                ? 'This listing is live in the public marketplace and can receive new booking requests.'
                : listing.status === 'sold'
                  ? 'This listing is marked as sold. Buyers can no longer submit new booking requests.'
                  : 'This listing is archived. It is hidden from the public marketplace and cannot receive new booking requests.'}
            </div>
          )}
          <h4 style={styles.sectionLabel}>Description</h4>
          <p style={styles.description}>{listing.description}</p>
        </section>

        {/* Meta info */}
        <section style={styles.section}>
          <h4 style={styles.sectionLabel}>Details</h4>
          <div style={styles.metaGrid}>
            <MetaRow label="Location" value={listing.location ?? '—'} />
            <MetaRow label="Posted by" value={listing.owner.username} />
            <MetaRow
              label="Listed on"
              value={new Date(listing.createdAt).toLocaleDateString()}
            />
          </div>
        </section>
      </div>

      {/* ── Booking section ─────────────────────────────────── */}
      {isOwner ? (
        // Seller: link through to the booking management page for this listing
        <div style={styles.bookingCard}>
          <h4 style={styles.sectionLabel}>Booking Requests</h4>
          <Link to={`/listings/${listing.id}/bookings`} style={styles.btnViewBookings}>
            View Bookings for This Listing →
          </Link>
        </div>
      ) : user ? (
        // Logged-in buyer: inline booking request form
        <div style={styles.bookingCard}>
          <h4 style={styles.sectionLabel}>Make a Booking Request</h4>
          {!canReceiveBookings ? (
            <p style={styles.bookingMuted}>
              This listing is no longer accepting booking requests.
            </p>
          ) : bookingSuccess ? (
            <p style={styles.bookingSuccess}>
              ✓ Request sent!{' '}
              <Link to="/bookings/mine" style={{ color: '#15803d' }}>View My Bookings</Link>.
            </p>
          ) : (
            <form onSubmit={handleBooking}>
              {bookingError && <p style={styles.bookingError}>{bookingError}</p>}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#4b5563' }}>
                  Message to seller{' '}
                  <span style={{ color: '#9ca3af' }}>(optional, max 500 chars)</span>
                </label>
                <textarea
                  style={styles.bookingTextarea}
                  value={bookingMsg}
                  onChange={(e) => setBookingMsg(e.target.value)}
                  placeholder="e.g. Available Saturday afternoon after 2pm"
                  maxLength={500}
                />
              </div>
              <button
                type="submit"
                style={styles.btnBook}
                disabled={bookingSubmitting}
              >
                {bookingSubmitting ? 'Sending...' : 'Send Booking Request'}
              </button>
            </form>
          )}
        </div>
      ) : (
        // Not logged in: prompt to sign in
        <div style={styles.bookingCard}>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            <Link to="/login" style={{ color: '#2563eb' }}>Log in</Link> to make a booking request.
          </p>
        </div>
      )}
    </div>
  );
}

// Small helper component for key-value rows in the details section
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: 100, color: '#6b7280', fontSize: 14, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: '40px auto', padding: '0 20px' },
  back: { display: 'inline-block', marginBottom: 20, color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 28, background: '#fff' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  badges: { display: 'flex', gap: 8, marginBottom: 10 },
  condition: {
    fontSize: 12, padding: '2px 8px', borderRadius: 4,
    background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
  },
  brand: {
    fontSize: 12, padding: '2px 8px', borderRadius: 4,
    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
  },
  status: {
    fontSize: 12, padding: '2px 8px', borderRadius: 4,
    border: '1px solid transparent',
  },
  statusActive: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
  statusSold: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  statusArchived: { background: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  title: { margin: '0 0 8px', fontSize: 22, fontWeight: 700 },
  price: { margin: 0, fontSize: 24, fontWeight: 700, color: '#2563eb' },
  ownerActions: { display: 'flex', gap: 10, flexShrink: 0 },
  btnEdit: {
    padding: '7px 16px', background: '#f3f4f6', color: '#374151',
    borderRadius: 6, textDecoration: 'none', fontSize: 14,
    border: '1px solid #d1d5db',
  },
  btnDelete: {
    padding: '7px 16px', background: '#fee2e2', color: '#dc2626',
    borderRadius: 6, fontSize: 14, border: '1px solid #fca5a5',
    cursor: 'pointer',
  },
  divider: { margin: '20px 0', borderColor: '#e5e7eb' },
  section: { marginBottom: 20 },
  ownerStatusNotice: {
    marginBottom: 14,
    padding: '12px 14px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.6,
    border: '1px solid transparent',
  },
  ownerStatusNoticeActive: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
  ownerStatusNoticeSold: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  ownerStatusNoticeArchived: { background: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' },
  sectionLabel: { margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
  description: { margin: 0, lineHeight: 1.7, color: '#374151' },
  metaGrid: { display: 'flex', flexDirection: 'column' },
  info: { textAlign: 'center', marginTop: 60, color: '#6b7280' },
  error: { textAlign: 'center', marginTop: 60, color: '#dc2626' },
  bookingCard: {
    marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 10,
    padding: 24, background: '#fff',
  },
  bookingMuted: { margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.6 },
  bookingSuccess: { margin: 0, color: '#15803d', fontSize: 14 },
  bookingError: { margin: '0 0 10px', color: '#dc2626', fontSize: 13 },
  bookingTextarea: {
    width: '100%', minHeight: 80, padding: '8px 12px',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14,
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
  },
  btnBook: {
    padding: '8px 20px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  },
  btnViewBookings: {
    display: 'inline-block', padding: '7px 16px',
    background: '#eff6ff', color: '#2563eb',
    border: '1px solid #bfdbfe', borderRadius: 6,
    textDecoration: 'none', fontSize: 14,
  },
  gallery: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  galleryItem: { position: 'relative', width: 140, height: 105, flexShrink: 0 },
  galleryImg: {
    width: '100%', height: '100%', objectFit: 'cover',
    borderRadius: 6, border: '1px solid #e5e7eb',
  },
  imgDeleteBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, lineHeight: '20px', textAlign: 'center',
    background: 'rgba(0,0,0,0.55)', color: '#fff',
    border: 'none', borderRadius: '50%',
    cursor: 'pointer', fontSize: 16, padding: 0,
  },
  uploadLabel: {
    display: 'inline-block', padding: '7px 14px', fontSize: 13,
    background: '#eff6ff', color: '#2563eb',
    border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer',
  },
  uploadLabelDisabled: {
    display: 'inline-block', padding: '7px 14px', fontSize: 13,
    background: '#f3f4f6', color: '#9ca3af',
    border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'not-allowed',
  },
  uploadError: { margin: '8px 0 0', fontSize: 13, color: '#dc2626' },
  noPhotosHint: { margin: '8px 0 0', fontSize: 13, color: '#9ca3af' },
};

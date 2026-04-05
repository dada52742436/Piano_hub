import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createBooking } from '../api/bookings';
import { createInquiry, getMyInquiries, type InquiryStatus } from '../api/inquiries';
import {
  deleteListing,
  deleteListingImage,
  getListingById,
  uploadListingImage,
  type Listing,
} from '../api/listings';
import { getMySavedListings, removeSavedListing, saveListing } from '../api/savedListings';
import { createTransaction, getMyTransactions, type TransactionStatus } from '../api/transactions';
import { CONDITION_LABELS } from '../constants/conditions';
import { LISTING_STATUS_LABELS } from '../constants/listingStatus';
import { useAuth } from '../context/AuthContext';
import {
  sharedBackLinkStyle,
  sharedPageHeadingStyle,
  sharedPageStyle,
  sharedPageSubheadingStyle,
} from '../styles/shared';

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [bookingMsg, setBookingMsg] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const [inquiryMsg, setInquiryMsg] = useState('');
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [existingInquiryStatus, setExistingInquiryStatus] = useState<InquiryStatus | null>(null);
  const [transactionPrice, setTransactionPrice] = useState('');
  const [transactionMsg, setTransactionMsg] = useState('');
  const [transactionSubmitting, setTransactionSubmitting] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [existingTransactionStatus, setExistingTransactionStatus] = useState<TransactionStatus | null>(null);

  const [isSaved, setIsSaved] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getListingById(Number(id))
      .then(setListing)
      .catch(() => setError('Listing not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!listing || !user || user.id === listing.ownerId) {
      setIsSaved(false);
      return;
    }

    getMySavedListings()
      .then((items) => setIsSaved(items.some((item) => item.listingId === listing.id)))
      .catch(() => {
        // Keep the page usable if the saved listings request fails.
      });
  }, [listing, user]);

  useEffect(() => {
    if (!listing || !user || user.id === listing.ownerId) {
      setExistingInquiryStatus(null);
      setExistingTransactionStatus(null);
      return;
    }

    Promise.all([getMyInquiries(), getMyTransactions()])
      .then(([items, transactions]) => {
        const existingInquiry = items.find((item) => item.listingId === listing.id);
        setExistingInquiryStatus(existingInquiry?.status ?? null);
        if (existingInquiry) {
          setInquirySuccess(true);
        }

        const existingTransaction = transactions.find((item) => item.listingId === listing.id);
        setExistingTransactionStatus(existingTransaction?.status ?? null);
        if (existingTransaction) {
          setTransactionSuccess(true);
        }
      })
      .catch(() => {
        // Keep the detail page usable even if the inquiries request fails.
      });
  }, [listing, user]);

  const isOwner = user !== null && listing !== null && user.id === listing.ownerId;
  const canReceiveBookings = listing?.status === 'active';

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

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setInquiryError('');
    setInquirySubmitting(true);
    try {
      await createInquiry(listing.id, inquiryMsg.trim());
      setInquirySuccess(true);
      setExistingInquiryStatus('open');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setInquiryError(
        Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to send inquiry.'),
      );
    } finally {
      setInquirySubmitting(false);
    }
  }

  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;

    const offeredPrice = Number(transactionPrice);
    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
      setTransactionError('Please enter a valid offer price.');
      return;
    }

    setTransactionError('');
    setTransactionSubmitting(true);
    try {
      await createTransaction(listing.id, {
        offeredPrice,
        message: transactionMsg.trim() || undefined,
      });
      setTransactionSuccess(true);
      setExistingTransactionStatus('initiated');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setTransactionError(
        Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to start transaction.'),
      );
    } finally {
      setTransactionSubmitting(false);
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
      // Keep the image visible if the delete request failed.
    }
  }

  async function handleDelete() {
    if (!listing) return;
    if (!window.confirm('Are you sure you want to delete this listing?')) return;

    setDeleting(true);
    try {
      await deleteListing(listing.id);
      navigate('/listings');
    } catch {
      setError('Failed to delete. Please try again.');
      setDeleting(false);
    }
  }

  async function handleToggleSave() {
    if (!listing) return;

    setSaveSubmitting(true);
    setSaveFeedback('');
    try {
      if (isSaved) {
        await removeSavedListing(listing.id);
        setIsSaved(false);
        setSaveFeedback('Removed from your saved listings.');
      } else {
        await saveListing(listing.id);
        setIsSaved(true);
        setSaveFeedback('Saved to your shortlist.');
      }
    } catch {
      setError(isSaved ? 'Failed to remove this saved listing.' : 'Failed to save this listing.');
    } finally {
      setSaveSubmitting(false);
    }
  }

  if (loading) return <p style={styles.info}>Loading...</p>;
  if (error) return <p style={styles.error}>{error}</p>;
  if (!listing) return null;

  return (
    <div style={styles.page}>
      <Link to="/listings" style={styles.back}>Back to Listings</Link>

      <div style={styles.card}>
        {saveFeedback && <p style={styles.saveFeedback}>{saveFeedback}</p>}

        <div style={styles.cardHeader}>
          <div>
            <div style={styles.badges}>
              <span style={styles.condition}>
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </span>
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
            <p style={styles.subheading}>
              {listing.location ?? 'Melbourne location pending'} · listed by {listing.owner.username}
            </p>
          </div>

          {isOwner && (
            <div style={styles.ownerActions}>
              <Link to={`/listings/${listing.id}/edit`} style={styles.btnEdit}>
                Edit
              </Link>
              <Link to={`/listings/${listing.id}/inquiries`} style={styles.btnEdit}>
                View Inquiries
              </Link>
              <Link to={`/listings/${listing.id}/transactions`} style={styles.btnEdit}>
                View Transactions
              </Link>
              <button
                style={styles.btnDelete}
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}

          {!isOwner && user && (
            <button
              type="button"
              style={{
                ...styles.btnSave,
                ...(isSaved ? styles.btnSaveActive : null),
              }}
              onClick={() => void handleToggleSave()}
              disabled={saveSubmitting}
            >
              {saveSubmitting ? 'Saving...' : isSaved ? 'Saved' : 'Save Listing'}
            </button>
          )}
        </div>

        <hr style={styles.divider} />

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
                  {uploading ? 'Uploading...' : '+ Add Photo'}
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

        <section style={styles.section}>
          <h4 style={styles.sectionLabel}>Details</h4>
          <div style={styles.metaGrid}>
            <MetaRow label="Location" value={listing.location ?? '—'} />
            <MetaRow label="Posted by" value={listing.owner.username} />
            <MetaRow label="Listed on" value={new Date(listing.createdAt).toLocaleDateString()} />
          </div>
        </section>
      </div>

      {isOwner ? (
        <div style={styles.secondaryCard}>
          <h4 style={styles.sectionLabel}>Transaction Requests</h4>
          <p style={styles.cardHint}>
            Transactions represent a stronger deal flow than an inquiry or booking request and can lead directly to a sold listing. Once one transaction is completed, other open transactions, bookings, and inquiries on this listing are closed automatically.
          </p>
          <Link to={`/listings/${listing.id}/transactions`} style={styles.btnViewCardAction}>
            View Transactions for This Listing
          </Link>
        </div>
      ) : user ? (
        <div style={styles.secondaryCard}>
          <h4 style={styles.sectionLabel}>Start a Transaction</h4>
          {existingTransactionStatus ? (
            <div style={styles.inquiryStateBox}>
              <p style={styles.inquiryStateText}>
                You already have a transaction on this listing.
              </p>
              <p style={styles.inquiryStateMeta}>
                Current status: <strong>{existingTransactionStatus.replaceAll('_', ' ')}</strong>. Review it in <Link to="/transactions/mine" style={styles.inlineLink}>My Transactions</Link>.
              </p>
              {existingTransactionStatus === 'cancelled' && listing.status === 'sold' && (
                <p style={{ ...styles.inquiryStateMeta, marginTop: 8 }}>
                  Another transaction has already completed, so this listing is no longer available.
                </p>
              )}
            </div>
          ) : transactionSuccess ? (
            <p style={styles.bookingSuccess}>
              Transaction started. <Link to="/transactions/mine" style={{ color: '#15803d' }}>View My Transactions</Link>.
            </p>
          ) : (
            <form onSubmit={handleTransaction}>
              {transactionError && <p style={styles.bookingError}>{transactionError}</p>}
              <div style={{ marginBottom: 12 }}>
                <label style={styles.textareaLabel}>Offer price</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={transactionPrice}
                  onChange={(e) => setTransactionPrice(e.target.value)}
                  placeholder={listing.price.toString()}
                  required
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={styles.textareaLabel}>
                  Message to seller <span style={styles.labelHint}>(optional, max 500 chars)</span>
                </label>
                <textarea
                  style={styles.textarea}
                  value={transactionMsg}
                  onChange={(e) => setTransactionMsg(e.target.value)}
                  placeholder="e.g. I am ready to move quickly if this offer works for you."
                  maxLength={500}
                />
              </div>
              <button
                type="submit"
                style={styles.btnSecondaryAction}
                disabled={transactionSubmitting}
              >
                {transactionSubmitting ? 'Starting...' : 'Start Transaction'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div style={styles.secondaryCard}>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            <Link to="/login" style={{ color: '#2563eb' }}>Log in</Link> to start a transaction.
          </p>
        </div>
      )}

      {isOwner ? (
        <div style={styles.secondaryCard}>
          <h4 style={styles.sectionLabel}>Inquiry Requests</h4>
          <p style={styles.cardHint}>
            Interested buyers can contact you here before deciding whether to send a booking request.
          </p>
          <Link to={`/listings/${listing.id}/inquiries`} style={styles.btnViewCardAction}>
            View Inquiries for This Listing
          </Link>
        </div>
      ) : user ? (
        <div style={styles.secondaryCard}>
          <h4 style={styles.sectionLabel}>Contact the Seller</h4>
          {existingInquiryStatus === 'open' ? (
            <div style={styles.inquiryStateBox}>
              <p style={styles.inquiryStateText}>
                You already have an open inquiry for this listing.
              </p>
              <p style={styles.inquiryStateMeta}>
                Need to follow up later? You can review it from <Link to="/inquiries/mine" style={styles.inlineLink}>My Inquiries</Link>.
              </p>
            </div>
          ) : existingInquiryStatus === 'closed' ? (
            <div style={styles.inquiryStateBoxMuted}>
              <p style={styles.inquiryStateTextMuted}>
                You previously contacted the seller and that inquiry is now closed.
              </p>
              <p style={styles.inquiryStateMetaMuted}>
                Closed inquiries stay visible in <Link to="/inquiries/mine" style={styles.inlineLinkMuted}>My Inquiries</Link> for reference.
              </p>
            </div>
          ) : inquirySuccess ? (
            <p style={styles.bookingSuccess}>
              Inquiry sent. <Link to="/inquiries/mine" style={{ color: '#15803d' }}>View My Inquiries</Link>.
            </p>
          ) : (
            <form onSubmit={handleInquiry}>
              {inquiryError && <p style={styles.bookingError}>{inquiryError}</p>}
              <div style={{ marginBottom: 12 }}>
                <label style={styles.textareaLabel}>
                  Message to seller <span style={styles.labelHint}>(required, max 1000 chars)</span>
                </label>
                <textarea
                  style={styles.textarea}
                  value={inquiryMsg}
                  onChange={(e) => setInquiryMsg(e.target.value)}
                  placeholder="e.g. Is this piano still available, and can you share its service history?"
                  maxLength={1000}
                  required
                />
              </div>
              <button
                type="submit"
                style={styles.btnSecondaryAction}
                disabled={inquirySubmitting}
              >
                {inquirySubmitting ? 'Sending...' : 'Send Inquiry'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div style={styles.secondaryCard}>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            <Link to="/login" style={{ color: '#2563eb' }}>Log in</Link> to contact the seller.
          </p>
        </div>
      )}

      {isOwner ? (
        <div style={styles.bookingCard}>
          <h4 style={styles.sectionLabel}>Booking Requests</h4>
          <p style={styles.cardHint}>
            Booking requests are a stronger next step after a buyer has reviewed your listing or already contacted you.
          </p>
          <Link to={`/listings/${listing.id}/bookings`} style={styles.btnViewCardAction}>
            View Bookings for This Listing
          </Link>
        </div>
      ) : user ? (
        <div style={styles.bookingCard}>
          <h4 style={styles.sectionLabel}>Make a Booking Request</h4>
          {!canReceiveBookings ? (
            <p style={styles.bookingMuted}>
              This listing is no longer accepting booking requests.
            </p>
          ) : bookingSuccess ? (
            <p style={styles.bookingSuccess}>
              Request sent. <Link to="/bookings/mine" style={{ color: '#15803d' }}>View My Bookings</Link>.
            </p>
          ) : (
            <form onSubmit={handleBooking}>
              {bookingError && <p style={styles.bookingError}>{bookingError}</p>}
              <div style={{ marginBottom: 12 }}>
                <label style={styles.textareaLabel}>
                  Message to seller <span style={styles.labelHint}>(optional, max 500 chars)</span>
                </label>
                <textarea
                  style={styles.textarea}
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
        <div style={styles.bookingCard}>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            <Link to="/login" style={{ color: '#2563eb' }}>Log in</Link> to make a booking request.
          </p>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: 100, color: '#6b7280', fontSize: 14, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { ...sharedPageStyle, maxWidth: 700 },
  back: sharedBackLinkStyle,
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 28, background: '#fff' },
  saveFeedback: {
    margin: '0 0 18px',
    padding: '10px 12px',
    borderRadius: 8,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontSize: 13,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  badges: { display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
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
  title: { ...sharedPageHeadingStyle, margin: '0 0 8px' },
  price: { margin: 0, fontSize: 24, fontWeight: 700, color: '#2563eb' },
  subheading: { ...sharedPageSubheadingStyle, marginTop: 10 },
  ownerActions: { display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
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
  btnSave: {
    padding: '7px 16px', background: '#ffffff', color: '#2563eb',
    borderRadius: 6, fontSize: 14, border: '1px solid #bfdbfe',
    cursor: 'pointer',
  },
  btnSaveActive: {
    background: '#eff6ff', color: '#1d4ed8', borderColor: '#93c5fd',
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
  secondaryCard: {
    marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 10,
    padding: 24, background: '#fff',
  },
  cardHint: { margin: '0 0 12px', color: '#6b7280', fontSize: 13, lineHeight: 1.6 },
  bookingCard: {
    marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 10,
    padding: 24, background: '#fff',
  },
  bookingMuted: { margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.6 },
  bookingSuccess: { margin: 0, color: '#15803d', fontSize: 14 },
  bookingError: { margin: '0 0 10px', color: '#dc2626', fontSize: 13 },
  inquiryStateBox: {
    padding: '12px 14px',
    borderRadius: 8,
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
  },
  inquiryStateBoxMuted: {
    padding: '12px 14px',
    borderRadius: 8,
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
  },
  inquiryStateText: { margin: '0 0 6px', color: '#1d4ed8', fontSize: 13, fontWeight: 600 },
  inquiryStateTextMuted: { margin: '0 0 6px', color: '#4b5563', fontSize: 13, fontWeight: 600 },
  inquiryStateMeta: { margin: 0, color: '#1e40af', fontSize: 13, lineHeight: 1.6 },
  inquiryStateMetaMuted: { margin: 0, color: '#6b7280', fontSize: 13, lineHeight: 1.6 },
  inlineLink: { color: '#1d4ed8' },
  inlineLinkMuted: { color: '#4b5563' },
  textareaLabel: { display: 'block', fontSize: 13, marginBottom: 6, color: '#4b5563' },
  labelHint: { color: '#9ca3af' },
  textarea: {
    width: '100%', minHeight: 80, padding: '8px 12px',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14,
    resize: 'vertical', boxSizing: 'border-box',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box',
  },
  btnBook: {
    padding: '8px 20px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  },
  btnSecondaryAction: {
    padding: '8px 20px', background: '#0f766e', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  },
  btnViewCardAction: {
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

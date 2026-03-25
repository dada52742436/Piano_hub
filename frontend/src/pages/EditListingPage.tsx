import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getListingById,
  updateListing,
  type UpdateListingPayload,
} from '../api/listings';
import { useAuth } from '../context/AuthContext';
import { CONDITIONS, type ListingCondition } from '../constants/conditions';
import { Field } from '../components/ui/Field';
import { sharedInputStyle } from '../styles/shared';

// CONDITIONS is imported from the shared constants file, which is the single
// source of truth for valid condition values across the entire frontend.

// Form state shape �?all strings for controlled inputs, converts on submit
interface FormState {
  title: string;
  description: string;
  price: string; // string so the <input type="number"> is controlled correctly
  brand: string;
  condition: ListingCondition;
  location: string;
}

export function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // On mount: fetch the existing listing and pre-fill the form
  useEffect(() => {
    if (!id) return;
    getListingById(Number(id))
      .then((listing) => {
        // Ownership guard on the client side �?redirect if not the owner
        // The backend will also enforce this with a 403, but we fail fast here
        if (user && listing.ownerId !== user.id) {
          navigate(`/listings/${id}`);
          return;
        }
        setForm({
          title: listing.title,
          description: listing.description,
          price: String(listing.price),
          brand: listing.brand ?? '',
          condition: listing.condition as ListingCondition,
          location: listing.location ?? '',
        });
      })
      .catch(() => setLoadError('Listing not found.'));
  }, [id, user, navigate]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !id) return;
    setSubmitError('');
    setSubmitting(true);

    try {
      // Build payload �?only send fields that differ or are non-empty
      const payload: UpdateListingPayload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        condition: form.condition,
        // Send null-equivalent as undefined so backend does a proper partial update
        ...(form.brand.trim() ? { brand: form.brand.trim() } : { brand: undefined }),
        ...(form.location.trim() ? { location: form.location.trim() } : { location: undefined }),
      };

      await updateListing(Number(id), payload);
      // On success, navigate to the detail page to see the updated listing
      navigate(`/listings/${id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to update listing.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p style={styles.stateMsg}>{loadError}</p>;
  if (!form) return <p style={styles.stateMsg}>Loading...</p>;

  return (
    <div style={styles.page}>
      <Link to={`/listings/${id}`} style={styles.back}>�?Back to Listing</Link>
      <h2 style={styles.heading}>Edit Listing</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        {submitError && <p style={styles.error}>{submitError}</p>}

        <Field label="Title *">
          <input
            style={sharedInputStyle}
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Description *">
          <textarea
            style={{ ...sharedInputStyle, height: 120, resize: 'vertical' }}
            name="description"
            value={form.description}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="Price (AUD $) *">
          <input
            style={sharedInputStyle}
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            min={0}
            required
          />
        </Field>

        <Field label="Condition *">
          <select
            style={sharedInputStyle}
            name="condition"
            value={form.condition}
            onChange={handleChange}
            required
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Brand (optional)">
          <input
            style={sharedInputStyle}
            name="brand"
            value={form.brand}
            onChange={handleChange}
            placeholder="e.g. Yamaha, Kawai, Steinway, Bösendorfer"
          />
        </Field>

        <Field label="Location (optional)">
          <input
            style={sharedInputStyle}
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="e.g. Melbourne CBD, Richmond, St Kilda"
          />
        </Field>

        <div style={styles.btnRow}>
          <Link to={`/listings/${id}`} style={styles.btnCancel}>
            Cancel
          </Link>
          <button type="submit" style={styles.btnSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: '40px auto', padding: '0 20px' },
  back: { display: 'inline-block', marginBottom: 20, color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  heading: { margin: '0 0 24px', fontSize: 22, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column' },
  btnRow: { display: 'flex', gap: 12, marginTop: 8 },
  btnCancel: {
    flex: 1, padding: '10px 0', textAlign: 'center',
    background: '#f3f4f6', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: 15,
    textDecoration: 'none',
  },
  btnSubmit: {
    flex: 1, padding: '10px 0', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
    cursor: 'pointer',
  },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  stateMsg: { textAlign: 'center', marginTop: 60, color: '#6b7280' },
};

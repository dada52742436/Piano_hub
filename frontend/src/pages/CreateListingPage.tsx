import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createListing, type CreateListingPayload } from '../api/listings';
import { CONDITIONS } from '../constants/conditions';
import { Field } from '../components/ui/Field';
import { sharedInputStyle } from '../styles/shared';

// CONDITIONS is the shared source of truth for valid condition values.
// The ListingCondition type flows in via CreateListingPayload below.

export function CreateListingPage() {
  const navigate = useNavigate();

  // Form field state
  const [form, setForm] = useState<CreateListingPayload>({
    title: '',
    description: '',
    price: 0,
    brand: '',
    condition: 'good',
    location: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Generic change handler �?works for all input/select/textarea fields
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      // price must be stored as a number, not a string
      [name]: name === 'price' ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Strip optional empty strings so they are not sent to the backend
      const payload: CreateListingPayload = {
        title: form.title,
        description: form.description,
        price: form.price,
        condition: form.condition,
        ...(form.brand?.trim() && { brand: form.brand.trim() }),
        ...(form.location?.trim() && { location: form.location.trim() }),
      };

      const created = await createListing(payload);
      // Navigate to the detail page of the newly created listing
      navigate(`/listings/${created.id}`);
    } catch (err: unknown) {
      // Show backend validation message if available, otherwise generic error
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create listing.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <Link to="/listings" style={styles.back}>�?Back to Listings</Link>
      <h2 style={styles.heading}>Post a Listing</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        {error && <p style={styles.error}>{error}</p>}

        <Field label="Title *">
          <input
            style={sharedInputStyle}
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Yamaha U1 Upright Piano"
            required
          />
        </Field>

        <Field label="Description *">
          <textarea
            style={{ ...sharedInputStyle, height: 120, resize: 'vertical' }}
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the piano �?age, condition details, reason for selling..."
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

        <button type="submit" style={styles.btnSubmit} disabled={submitting}>
          {submitting ? 'Posting...' : 'Post Listing'}
        </button>
      </form>
    </div>
  );
}

// Field is imported from src/components/ui/Field.tsx

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: '40px auto', padding: '0 20px' },
  back: { display: 'inline-block', marginBottom: 20, color: '#2563eb', textDecoration: 'none', fontSize: 14 },
  heading: { margin: '0 0 24px', fontSize: 22, fontWeight: 700 },
  form: { display: 'flex', flexDirection: 'column' },
  btnSubmit: {
    marginTop: 8, padding: '10px 0', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
    cursor: 'pointer',
  },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
};

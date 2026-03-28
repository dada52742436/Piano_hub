import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllListings,
  type PaginatedListings,
  type GetListingsParams,
} from '../api/listings';
import { useAuth } from '../context/AuthContext';
import { CONDITION_LABELS, CONDITIONS } from '../constants/conditions';
import { LISTING_STATUS_LABELS } from '../constants/listingStatus';

// Shape of the filter form — separate from page so that page can reset independently
interface Filters {
  search: string;
  condition: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  condition: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
};

export function ListingsPage() {
  const { user } = useAuth();

  // draft: what the user has typed into the form, not yet applied
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  // filters: committed to the backend — changing this triggers a fetch
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PaginatedListings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Re-fetch whenever the committed filters or page changes.
  // setLoading(true) is NOT called here to avoid a synchronous setState-in-effect
  // lint warning. On subsequent fetches the stale results remain visible while the
  // new data arrives (better UX than a blank flash).
  useEffect(() => {
    let cancelled = false;

    // Only include params that have a value — omitting them means "no filter"
    const params: GetListingsParams = { page };
    if (filters.search) params.search = filters.search;
    if (filters.condition) params.condition = filters.condition;
    if (filters.brand) params.brand = filters.brand;
    if (filters.minPrice) params.minPrice = Number(filters.minPrice);
    if (filters.maxPrice) params.maxPrice = Number(filters.maxPrice);

    getAllListings(params)
      .then((data) => { if (!cancelled) setResult(data); })
      .catch(() => { if (!cancelled) setError('Failed to load listings.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filters, page]);

  // Commit the draft to filters and jump back to page 1
  function applyFilters() {
    setFilters({ ...draft });
    setPage(1);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  // Condition dropdown applies immediately (single click, no typing needed)
  function handleConditionChange(value: string) {
    setDraft((prev) => ({ ...prev, condition: value }));
    setFilters((prev) => ({ ...prev, condition: value }));
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const listings = result?.data ?? [];

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <h2 style={styles.title}>All Listings</h2>
        <div style={styles.actions}>
          {user && (
            <Link to="/listings/new" style={styles.btnPrimary}>
              + Post a Listing
            </Link>
          )}
          {user && (
            <Link to="/listings/mine" style={styles.btnSecondary}>
              My Listings
            </Link>
          )}
          {user && (
            <Link to="/bookings/mine" style={styles.btnSecondary}>
              My Bookings
            </Link>
          )}
          {user && (
            <Link to="/dashboard" style={styles.btnSecondary}>
              Dashboard
            </Link>
          )}
          {!user && (
            <Link to="/login" style={styles.btnSecondary}>
              Login to Post
            </Link>
          )}
        </div>
      </div>

      <p style={styles.marketplaceNote}>
        Public marketplace results only show active listings that are currently available.
      </p>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div style={styles.filterBar}>
        {/* Full-text search across title + description */}
        <input
          style={styles.filterInput}
          type="text"
          placeholder="Search title or description…"
          value={draft.search}
          onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        />

        {/* Condition — applies immediately on change */}
        <select
          style={styles.filterSelect}
          value={draft.condition}
          onChange={(e) => handleConditionChange(e.target.value)}
        >
          <option value="">All Conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Brand partial match */}
        <input
          style={{ ...styles.filterInput, width: 120 }}
          type="text"
          placeholder="Brand"
          value={draft.brand}
          onChange={(e) => setDraft((prev) => ({ ...prev, brand: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        />

        {/* Price range */}
        <input
          style={{ ...styles.filterInput, width: 90 }}
          type="number"
          placeholder="Min $"
          min={0}
          value={draft.minPrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        />
        <span style={{ color: '#9ca3af', fontSize: 13, flexShrink: 0 }}>–</span>
        <input
          style={{ ...styles.filterInput, width: 90 }}
          type="number"
          placeholder="Max $"
          min={0}
          value={draft.maxPrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
        />

        <button style={styles.btnSearch} onClick={applyFilters}>
          Search
        </button>
        {hasActiveFilters && (
          <button style={styles.btnClear} onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* ── Results summary ─────────────────────────────────────────── */}
      {result && !loading && (
        <p style={styles.resultsInfo}>
          {result.total === 0
            ? 'No listings found.'
            : `Showing ${(result.page - 1) * result.limit + 1}–${Math.min(
                result.page * result.limit,
                result.total,
              )} of ${result.total} listing${result.total !== 1 ? 's' : ''}`}
          {hasActiveFilters && (
            <button style={styles.btnClearInline} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </p>
      )}

      {loading && <p style={styles.info}>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && listings.length === 0 && !hasActiveFilters && (
        <p style={styles.info}>No active listings yet. Be the first to post one!</p>
      )}

      {/* ── Listing grid ────────────────────────────────────────────── */}
      <div style={styles.grid}>
        {listings.map((listing) => (
          <Link to={`/listings/${listing.id}`} key={listing.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.condition}>
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </span>
              <span style={{ ...styles.status, ...styles.statusActive }}>
                {LISTING_STATUS_LABELS[listing.status]}
              </span>
              {listing.brand && <span style={styles.brand}>{listing.brand}</span>}
            </div>
            <h3 style={styles.cardTitle}>{listing.title}</h3>
            <p style={styles.price}>${listing.price.toLocaleString()}</p>
            <p style={styles.meta}>
              {listing.location ?? 'Location not specified'} · by {listing.owner.username}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {result && result.totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.btnPage}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={styles.pageInfo}>
            Page {page} of {result.totalPages}
          </span>
          <button
            style={styles.btnPage}
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 900, margin: '40px auto', padding: '0 20px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { margin: 0, fontSize: 24 },
  marketplaceNote: { margin: '0 0 16px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 },
  actions: { display: 'flex', gap: 12 },
  btnPrimary: {
    padding: '8px 16px',
    background: '#2563eb',
    color: '#fff',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
  },
  btnSecondary: {
    padding: '8px 16px',
    background: '#f3f4f6',
    color: '#374151',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 14,
    border: '1px solid #d1d5db',
  },
  // ── Filter bar
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
  },
  filterInput: {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    flex: '1 1 160px',
  },
  filterSelect: {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    background: '#fff',
    cursor: 'pointer',
  },
  btnSearch: {
    padding: '7px 16px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
  },
  btnClear: {
    padding: '7px 14px',
    background: '#fff',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
  },
  // ── Results info
  resultsInfo: {
    margin: '0 0 14px',
    fontSize: 13,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  btnClearInline: {
    padding: '3px 10px',
    background: 'transparent',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  info: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 40 },
  // ── Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'block',
    padding: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    textDecoration: 'none',
    color: 'inherit',
    background: '#fff',
    transition: 'box-shadow 0.15s',
  },
  cardHeader: { display: 'flex', gap: 8, marginBottom: 8 },
  condition: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
  brand: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
  },
  status: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 4,
    border: '1px solid transparent',
  },
  statusActive: {
    background: '#eff6ff',
    color: '#1d4ed8',
    borderColor: '#bfdbfe',
  },
  cardTitle: { margin: '0 0 8px', fontSize: 16, fontWeight: 600 },
  price: { margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#2563eb' },
  meta: { margin: 0, fontSize: 13, color: '#6b7280' },
  // ── Pagination
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 32,
  },
  btnPage: {
    padding: '7px 18px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
  },
  pageInfo: { fontSize: 14, color: '#6b7280' },
};


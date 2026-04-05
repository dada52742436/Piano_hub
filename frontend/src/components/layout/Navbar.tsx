import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <div style={styles.brandBlock}>
          <NavLink to="/listings" style={styles.brandLink}>
            PianoHub
          </NavLink>
          <span style={styles.tagline}>Melbourne pre-owned piano marketplace</span>
        </div>

        <nav style={styles.nav}>
          <NavItem to="/listings">Browse</NavItem>

          {user ? (
            <>
              <NavItem to="/listings/new">Post Listing</NavItem>
              <NavItem to="/listings/mine">My Listings</NavItem>
              <NavItem to="/saved-listings/mine">Saved</NavItem>
              <NavItem to="/bookings/mine">My Bookings</NavItem>
              <NavItem to="/transactions/mine">My Transactions</NavItem>
              <NavItem to="/payments/mine">My Payments</NavItem>
              <NavItem to="/inquiries/mine">My Inquiries</NavItem>
              <NavItem to="/dashboard">Dashboard</NavItem>
              <div style={styles.userBlock}>
                <span style={styles.userMeta}>Signed in as</span>
                <span style={styles.userChip}>{user.username}</span>
              </div>
              <button type="button" onClick={handleLogout} style={styles.logoutBtn}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <NavItem to="/login">Login</NavItem>
              <NavLink
                to="/register"
                style={({ isActive }) => ({
                  ...styles.ctaLink,
                  ...(isActive ? styles.ctaLinkActive : null),
                })}
              >
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...styles.link,
        ...(isActive ? styles.linkActive : null),
      })}
    >
      {children}
    </NavLink>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(248, 250, 252, 0.94)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #e2e8f0',
  },
  inner: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  brandLink: {
    color: '#0f172a',
    textDecoration: 'none',
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.03em',
  },
  tagline: {
    color: '#64748b',
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  link: {
    color: '#475569',
    textDecoration: 'none',
    fontSize: 14,
    padding: '8px 12px',
    borderRadius: 999,
  },
  linkActive: {
    background: '#e0f2fe',
    color: '#0369a1',
  },
  ctaLink: {
    color: '#ffffff',
    background: '#0f766e',
    textDecoration: 'none',
    fontSize: 14,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #0f766e',
  },
  ctaLinkActive: {
    background: '#115e59',
    borderColor: '#115e59',
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
  },
  userMeta: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  userChip: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: 600,
  },
  logoutBtn: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontSize: 14,
    cursor: 'pointer',
  },
};

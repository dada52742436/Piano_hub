import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getProfile } from '../api/auth';
import { useAuth } from '../context/AuthContext';

interface ProfileData {
  message: string;
  user: {
    id: number;
    email: string;
    username: string;
    createdAt: string;
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  // Request the protected profile endpoint when the page loads.
  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {
        setError('Your session has expired. Please log in again.');
      });
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Welcome back, {user?.username}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/listings" style={styles.logoutBtn}>Browse Listings</Link>
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div style={styles.divider} />

        {error && <div style={styles.error}>{error}</div>}

        {profile ? (
          <div>
            <p style={styles.badge}>Protected page access confirmed. Backend token validation succeeded.</p>
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
            <p style={styles.desc}>{profile.message}</p>
          </div>
        ) : !error ? (
          <p style={{ color: '#888' }}>Loading...</p>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card: { background: '#fff', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', width: '480px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '20px' },
  logoutBtn: { padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  divider: { height: '1px', background: '#f0f0f0', margin: '20px 0' },
  error: { background: '#fff1f0', border: '1px solid #ffa39e', color: '#cf1322', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' },
  badge: { background: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', padding: '8px 12px', borderRadius: '4px', fontSize: '14px', marginBottom: '16px' },
  infoBox: { background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '16px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '14px' },
  infoLabel: { color: '#888', fontWeight: 500 },
  desc: { marginTop: '16px', color: '#555', fontSize: '14px', textAlign: 'center' },
};

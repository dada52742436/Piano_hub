import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // 组件加载时请求受保护接口，验证 token 有效性
  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {
        setError('Token 已过期，请重新登录');
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
          <h2 style={styles.title}>欢迎回来，{user?.username} 👋</h2>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            退出登录
          </button>
        </div>

        <div style={styles.divider} />

        {error && <div style={styles.error}>{error}</div>}

        {profile ? (
          <div>
            <p style={styles.badge}>✅ 受保护页面 — 后端验证 Token 成功</p>
            <div style={styles.infoBox}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>用户 ID</span>
                <span>{profile.user.id}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>邮箱</span>
                <span>{profile.user.email}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>用户名</span>
                <span>{profile.user.username}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>注册时间</span>
                <span>{new Date(profile.user.createdAt).toLocaleString('zh-CN')}</span>
              </div>
            </div>
            <p style={styles.desc}>{profile.message}</p>
          </div>
        ) : !error ? (
          <p style={{ color: '#888' }}>加载中...</p>
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

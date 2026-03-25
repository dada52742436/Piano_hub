import type React from 'react';

/**
 * Shared style constants used across form pages (auth + listings).
 * Import only what you need to avoid bundling unused styles.
 */

export const sharedInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 14,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  boxSizing: 'border-box',
  outline: 'none',
};

export const sharedBackLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: 20,
  color: '#2563eb',
  textDecoration: 'none',
  fontSize: 14,
};

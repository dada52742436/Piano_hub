import type React from 'react';

interface FieldProps {
  /** Label text shown above the input */
  label: string;
  children: React.ReactNode;
}

/**
 * Reusable form field wrapper — renders a label above its children.
 * Shared by CreateListingPage, EditListingPage, and future form pages.
 */
export function Field({ label, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

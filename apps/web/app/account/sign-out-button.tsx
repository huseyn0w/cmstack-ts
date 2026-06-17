'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      style={{
        padding: '0.6rem 1.2rem',
        background: 'transparent',
        border: '1px solid var(--line)',
        borderRadius: 6,
        color: 'var(--muted)',
        cursor: 'pointer',
        fontSize: 14,
        fontFamily: 'inherit',
      }}
    >
      Sign out
    </button>
  );
}

'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 6,
  color: 'var(--fg)',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Network error — still show the neutral confirmation (no enumeration).
    }
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p style={{ margin: 0, fontSize: 15, color: 'var(--fg)', lineHeight: 1.6 }}>
        If an account exists for that email, a password-reset link is on its way. Check your inbox
        (and spam folder).
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
    >
      <div>
        <label
          htmlFor="email"
          style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.7rem',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 15,
          fontFamily: 'inherit',
          background: 'var(--primary)',
          color: 'var(--primary-contrast)',
          border: 'none',
          fontWeight: 600,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

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

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      setLoading(false);
      if (!res.ok) {
        setError('This reset link is invalid or has expired. Request a new one.');
        return;
      }
      setDone(true);
    } catch {
      setLoading(false);
      setError('Something went wrong. Please try again.');
    }
  }

  if (done) {
    return (
      <p style={{ margin: 0, fontSize: 15, color: 'var(--fg)', lineHeight: 1.6 }}>
        Your password has been updated.{' '}
        <a href="/signin" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Sign in →
        </a>
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
          htmlFor="password"
          style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
        >
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label
          htmlFor="confirm"
          style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: '#f08c8c' }}>{error}</p>}

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
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

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

export function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

    try {
      const body: { email: string; password: string; name?: string } = { email, password };
      if (name.trim()) body.name = name.trim();

      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        setError('An account with this email already exists.');
        setLoading(false);
        return;
      }

      if (res.status === 400) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Invalid input. Please check your details.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      // Registration succeeded — sign in to establish the session.
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (!result || result.error) {
        // Registered but couldn't sign in automatically; redirect to sign-in.
        window.location.href = '/signin';
        return;
      }

      window.location.href = '/account';
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
    >
      <div>
        <label
          htmlFor="name"
          style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
        >
          Name <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(optional)</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>
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
      <div>
        <label
          htmlFor="password"
          style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
        >
          Password <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>(min 8 chars)</span>
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 15,
          fontFamily: 'inherit',
          fontWeight: 600,
          color: '#0b0b0c',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}

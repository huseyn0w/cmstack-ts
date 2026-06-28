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

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem',
  border: '1px solid var(--line)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 15,
  fontFamily: 'inherit',
};

interface Props {
  googleEnabled: boolean;
  githubEnabled: boolean;
}

export function SignInForm({ googleEnabled, githubEnabled }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result || result.error) {
      setError('Invalid email or password.');
      return;
    }

    window.location.href = '/account';
  }

  async function handleOAuth(provider: 'google' | 'github') {
    await signIn(provider, { redirectTo: '/account' });
  }

  return (
    <div>
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
        <div>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
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
            ...btnStyle,
            background: 'var(--primary)',
            color: 'var(--primary-contrast)',
            border: 'none',
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {(googleEnabled || githubEnabled) && (
        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '0 0 1rem',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span>or continue with</span>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {googleEnabled && (
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                style={{ ...btnStyle, background: 'transparent', color: 'var(--fg)' }}
              >
                Continue with Google
              </button>
            )}
            {githubEnabled && (
              <button
                type="button"
                onClick={() => handleOAuth('github')}
                style={{ ...btnStyle, background: 'transparent', color: 'var(--fg)' }}
              >
                Continue with GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

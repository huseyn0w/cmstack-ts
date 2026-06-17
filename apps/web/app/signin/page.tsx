import { SignInForm } from './sign-in-form';

// Server component: reads env vars and passes provider availability to the client form.
export default function SignInPage() {
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <p
          style={{
            margin: '0 0 0.5rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: 'var(--accent)',
          }}
        >
          Typress
        </p>
        <h1 style={{ fontSize: 28, margin: '0 0 2rem', lineHeight: 1.1 }}>Sign in</h1>
        <SignInForm googleEnabled={googleEnabled} githubEnabled={githubEnabled} />
        <p style={{ marginTop: '1.5rem', color: 'var(--muted)', fontSize: 14 }}>
          No account?{' '}
          <a href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create one →
          </a>
        </p>
      </div>
    </main>
  );
}

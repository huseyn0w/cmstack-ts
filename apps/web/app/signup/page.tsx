import { SignUpForm } from './sign-up-form';

export default function SignUpPage() {
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
        <h1 style={{ fontSize: 28, margin: '0 0 2rem', lineHeight: 1.1 }}>Create account</h1>
        <SignUpForm />
        <p style={{ marginTop: '1.5rem', color: 'var(--muted)', fontSize: 14 }}>
          Already have an account?{' '}
          <a href="/signin" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Sign in →
          </a>
        </p>
      </div>
    </main>
  );
}

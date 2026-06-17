import { publicUserSchema } from '@typress/config';
import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import { apiBaseUrl } from '../lib/api';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--muted)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  );
}

export default async function AccountPage() {
  const session = await auth();

  if (!session) {
    redirect('/signin');
  }

  // Server-side fetch of the canonical user from the API.
  const meRes = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!meRes.ok) {
    redirect('/signin');
  }

  const meData = publicUserSchema.safeParse(await meRes.json());
  if (!meData.success) {
    redirect('/signin');
  }

  const user = meData.data;

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '2rem',
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 0.4rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                fontSize: 12,
                color: 'var(--accent)',
              }}
            >
              Typress
            </p>
            <h1 style={{ fontSize: 24, margin: 0 }}>My account</h1>
          </div>
          <SignOutButton />
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: 13,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              margin: '0 0 0.5rem',
            }}
          >
            Profile
          </h2>
          <Row label="Email" value={user.email} />
          <Row label="Name" value={user.name ?? '—'} />
        </section>

        {user.role && (
          <section style={{ marginBottom: '2rem' }}>
            <h2
              style={{
                fontSize: 13,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                margin: '0 0 0.5rem',
              }}
            >
              Role
            </h2>
            <Row label="Role" value={user.role.name} />
          </section>
        )}

        {user.role && user.role.permissions.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: 13,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                margin: '0 0 0.75rem',
              }}
            >
              Permissions
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {user.role.permissions.map((p) => (
                <span
                  key={`${p.action}:${p.subject}`}
                  style={{
                    padding: '0.25rem 0.6rem',
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  {p.action}:{p.subject}
                </span>
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: '2rem' }}>
          <a href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}

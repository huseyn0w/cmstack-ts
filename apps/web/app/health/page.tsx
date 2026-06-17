import { type HealthResponse, healthResponseSchema } from '@typress/config';

export const dynamic = 'force-dynamic';

// Server-side fetches use the internal URL (e.g. http://api:4000 in Docker);
// the browser-facing NEXT_PUBLIC_API_URL is for client components.
const apiBaseUrl =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ProbeResult =
  | { ok: true; health: HealthResponse; ready: boolean }
  | { ok: false; error: string };

async function probeApi(): Promise<ProbeResult> {
  try {
    const [healthRes, readyRes] = await Promise.all([
      fetch(`${apiBaseUrl}/health`, { cache: 'no-store' }),
      fetch(`${apiBaseUrl}/health/ready`, { cache: 'no-store' }),
    ]);
    const health = healthResponseSchema.parse(await healthRes.json());
    const ready = (await readyRes.json())?.database === 'up';
    return { ok: true, health, ready };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function Row({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: good ? '#7fdca4' : '#f08c8c' }} data-testid={`status-${label}`}>
        {value}
      </span>
    </div>
  );
}

export default async function HealthPage() {
  const probe = await probeApi();

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <section style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, marginBottom: '1.5rem' }}>System status</h1>
        {probe.ok ? (
          <>
            <Row label="api" value={probe.health.status} good={probe.health.status === 'ok'} />
            <Row label="database" value={probe.ready ? 'up' : 'down'} good={probe.ready} />
          </>
        ) : (
          <Row label="api" value="unreachable" good={false} />
        )}
      </section>
    </main>
  );
}

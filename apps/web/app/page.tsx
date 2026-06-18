import { getActiveTheme } from '@/themes/active-theme';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { Layout, Home } = await getActiveTheme();
  return (
    <Layout>
      <Home />
    </Layout>
  );
}

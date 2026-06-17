import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume shared workspace packages from source/dist transparently.
  transpilePackages: ['@typress/config'],
  // Standalone output keeps the production Docker image small.
  output: 'standalone',
  // Trace files from the monorepo root so workspace packages are bundled correctly.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Email intake: sanitize-html pulls in ESM-only htmlparser2, which webpack cannot
  // bundle for the server layer (build fails with 'ESM packages need to be imported').
  // Load these with Node at runtime instead of bundling them.
  experimental: {
    serverComponentsExternalPackages: ['sanitize-html', 'htmlparser2', 'mailparser'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lxfiziwsqezjjybeguqq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    // The Custom Flashing Configurator (app/configure/page.tsx) was
    // eliminated (hpd-002) â€” redundant with FlashDraft. These cover any
    // indexed or bookmarked link so nothing 404s.
    return [
      { source: '/configure', destination: '/studio/draft', permanent: true },
      { source: '/configure/:path*', destination: '/studio/draft', permanent: true },
      { source: '/configurator', destination: '/studio/draft', permanent: true },
      { source: '/configurator/:path*', destination: '/studio/draft', permanent: true },
    ];
  },
};

module.exports = nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // eliminated (hpd-002) — redundant with FlashDraft. These cover any
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Capacitor native app builds.
  // When deploying to Vercel/web, remove or comment out `output: 'export'`.
  output: "export",
  images: {
    unoptimized: true, // Required for static export (no server-side image optimization)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;

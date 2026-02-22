/** @type {import('next').NextConfig} */
const { version } = require("./package.json");

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // Static export for Capacitor native app builds.
  // When deploying to Vercel/web, remove or comment out `output: 'export'`.
  output: "export",
  // Required for Capacitor: outputs friends/index.html instead of friends.html
  // so capacitor://localhost/friends/ resolves correctly in WKWebView.
  trailingSlash: true,
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

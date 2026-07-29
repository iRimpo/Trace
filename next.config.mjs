/** @type {import('next').NextConfig} */
const nextConfig = {
  // A production build writes to the same .next the dev server is serving
  // from, which swaps its chunks mid-flight and produces confusing
  // "Cannot find module './948.js'" and hydration errors that look like
  // application bugs. `npm run build:check` sets this to build somewhere else
  // while dev is running; CI and Vercel leave it unset and use .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow isolated build outputs (e.g. NEXT_DIST_DIR=.next-build) so `next build`
  // does not interfere with a running `next dev` instance that uses `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next"
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: intentionally NOT using `output: 'export'`.
  // Every page here is statically prerendered, but keeping the default
  // output leaves the door open for the Vercel Function the Phase 5
  // contact form needs. See PLAN.md.
};

export default nextConfig;

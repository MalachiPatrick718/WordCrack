/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Allow importing assets from the sibling React Native app (monorepo-style).
  experimental: { externalDir: true },
};

export default nextConfig;


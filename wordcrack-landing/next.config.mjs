/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Allow importing assets from the sibling React Native app (monorepo-style).
  experimental: { externalDir: true },
  // Needed for GitHub Pages project sites (https://<user>.github.io/<repo>/)
  // The workflow sets NEXT_PUBLIC_BASE_PATH="/<repo>".
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@product/ui", "@product/config", "@product/core"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

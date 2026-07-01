/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@product/ui", "@product/config", "@product/core"],
};

export default nextConfig;

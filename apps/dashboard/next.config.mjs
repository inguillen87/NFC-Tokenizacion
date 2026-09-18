/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  outputFileTracingIncludes: { "/api/integration-kit": ["./resources/integration-kit/*.tgz"] },
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@product/ui", "@product/config", "@product/core"],
};

export default nextConfig;

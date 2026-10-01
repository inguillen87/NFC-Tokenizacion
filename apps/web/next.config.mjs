/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@product/ui", "@product/config", "@product/core"],
  async headers() {
    return [
      {source: "/maplibre/6.4.1/:asset",headers:[
        {key:"Cache-Control",value:"public, max-age=31536000, immutable"},
        {key:"Referrer-Policy",value:"no-referrer"},
        {key:"X-Content-Type-Options",value:"nosniff"},
      ]},
      {
        source: "/sun",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;

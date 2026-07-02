import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/product/:path*",
        destination: "/products/:path*",
        permanent: true,
      },
      { source: "/product", destination: "/products", permanent: true },
      { source: "/shop", destination: "/products", permanent: true },
    ];
  },
};

export default nextConfig;

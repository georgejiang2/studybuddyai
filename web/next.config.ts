import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/:path((?!api|_next|assets|favicon\\.svg|icons\\.svg).*)",
        destination: "/index.html",
      },
    ];
  },
};

export default nextConfig;

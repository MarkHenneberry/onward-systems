import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Allow loading dev resources (HMR, etc.) from this LAN IP for phone testing.
  // Dev-only — has no effect on production builds.
  allowedDevOrigins: ["192.168.2.53"],
};

export default nextConfig;

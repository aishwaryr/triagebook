import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables "use cache" / cacheTag / updateTag. Side effect: pages you leave stay
  // mounted (hidden by <Activity>), so client state survives navigation.
  cacheComponents: true,
  // Tailscale host name, so `next dev` hot reload works when opened from the MacBook.
  allowedDevOrigins: ["anakin"],
};

export default nextConfig;

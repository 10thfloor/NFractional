import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flow-hackathon/cadence"],
  experimental: { externalDir: true },
  output: "standalone",
};

export default nextConfig;

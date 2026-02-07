import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["jaba-test-client.loca.lt", "localhost:3000"]
    }
  }
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // silence the lockfile warning !!
    root: path.resolve(__dirname),
  },
};

export default nextConfig;  
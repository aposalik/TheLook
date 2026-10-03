import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack ignores stray parent lockfiles.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;

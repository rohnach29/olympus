import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bcrypt is a native addon. Without this, Next tries to bundle its .node
  // binary into the serverless function and it fails to load at runtime —
  // login and signup work locally and break once deployed.
  serverExternalPackages: ["bcrypt"],
};

export default nextConfig;

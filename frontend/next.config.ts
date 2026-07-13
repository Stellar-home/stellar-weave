import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the locally-generated contract client packages so Next.js
  // processes their TypeScript/ESM through its own pipeline.
  transpilePackages: ["profile-registry-client", "follow-graph-client"],

  turbopack: {
    // stellar-sdk uses Node's `Buffer` in browser bundles; polyfill it.
    resolveAlias: {
      buffer: "buffer/",
    },
  },
};

export default nextConfig;

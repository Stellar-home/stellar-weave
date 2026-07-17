import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile locally-generated contract clients and SWK (ESM/JSR package)
  // so Next.js processes them through its own pipeline.
  transpilePackages: [
    "profile-registry-client",
    "follow-graph-client",
    "@creit-tech/stellar-wallets-kit",
  ],

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any, { isServer }: { isServer: boolean }) {
    if (!isServer) {
      // stellar-sdk and tweetnacl-util reference Node's `Buffer` in browser
      // bundles; polyfill it with the `buffer` npm package.
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        buffer: require.resolve("buffer/"),
      };
    }
    return config;
  },
};

export default nextConfig;

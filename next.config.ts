import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // deck.gl and maplibre-gl use ES modules; transpile them for Next.js
  transpilePackages: [
    "deck.gl",
    "@deck.gl/core",
    "@deck.gl/react",
    "@deck.gl/layers",
    "@deck.gl/aggregation-layers",
    "@deck.gl/geo-layers",
    "@luma.gl/core",
    "@luma.gl/engine",
    "@luma.gl/gltools",
    "@luma.gl/shadertools",
    "@luma.gl/webgl",
    "@math.gl/core",
    "@math.gl/web-mercator",
    "react-map-gl",
  ],
  webpack: (config, { isServer }) => {
    // maplibre-gl is browser-only; stub it on the server side
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "maplibre-gl": false,
        "react-map-gl": false,
      };
    }
    return config;
  },
  experimental: {
    // Required for certain deck.gl internals
    esmExternals: "loose",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chromium for PDF export runs as an external package on the server.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "potrace", "sharp"],
  // Paper.js (line-art editor) only requires jsdom / canvas when run under Node, which never
  // happens: the editor imports it in the browser. Keep those out of the SSR bundle.
  turbopack: {
    resolveAlias: {
      jsdom: "./src/lib/empty.ts",
      "jsdom/lib/jsdom/living/generated/utils": "./src/lib/empty.ts",
      canvas: "./src/lib/empty.ts",
    },
  },
  // Files read at runtime: the English word list (spell-check) and the PDF font.
  outputFileTracingIncludes: {
    "/api/packs/*/pdf": [
      "./node_modules/word-list/words.txt",
      "./src/assets/fonts/**",
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@fontsource/noto-sans-sc/700.css",
      "./node_modules/@fontsource/noto-sans-sc/files/*-700-normal.woff2",
    ],
    "/api/packs/*/export": [
      "./node_modules/word-list/words.txt",
      "./src/assets/fonts/**",
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@fontsource/noto-sans-sc/700.css",
      "./node_modules/@fontsource/noto-sans-sc/files/*-700-normal.woff2",
    ],
    "/api/packs/*/flats/*": ["./src/assets/fonts/**", "./node_modules/@sparticuz/chromium/bin/**"],
    "/api/packs/*/validation": ["./node_modules/word-list/words.txt"],
    "/packs/*": ["./node_modules/word-list/words.txt"],
  },
};

export default nextConfig;

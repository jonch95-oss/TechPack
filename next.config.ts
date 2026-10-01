import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chromium for PDF export runs as an external package on the server.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Files read at runtime: the English word list (spell-check) and the PDF font.
  outputFileTracingIncludes: {
    "/api/packs/*/pdf": ["./node_modules/word-list/words.txt", "./src/assets/fonts/**", "./node_modules/@sparticuz/chromium/bin/**"],
    "/packs/*": ["./node_modules/word-list/words.txt"],
  },
};

export default nextConfig;

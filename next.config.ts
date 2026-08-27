import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,

  /**
   * initChatModel resolves its provider package with a fully dynamic import, which
   * a bundler cannot trace, so the package was left out of the serverless bundle
   * and the deployed route failed with "Cannot find module as expression is too
   * dynamic". Marking these external makes the import a plain runtime require
   * against node_modules, which is what the provider-string contract in ADR 0002
   * needs to work.
   */
  serverExternalPackages: [
    "langchain",
    "@langchain/core",
    "@langchain/google-genai",
    "@langchain/community",
    "pdf-parse",
    "exceljs",
    "mammoth",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nujgeowsnjculknvimbh.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  /**
   * No serverActions.bodySizeLimit: file bytes go straight to storage through a
   * signed URL, so no action carries a document. The old 15mb limit contradicted
   * the 50MB limit the upload schema declares.
   */
};

export default nextConfig;

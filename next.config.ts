import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  /** Cache Components prefetches the static shell and streams the rest. */
  partialPrefetching: true,

  experimental: {
    /**
     * Next transpiles a TypeScript config through the compiler API, and the
     * native TypeScript 7 compiler does not expose the internals it reaches for:
     * `next build` fails with "Cannot read properties of undefined (reading
     * 'fileExists')". This routes it through the CLI instead.
     */
    useTypeScriptCli: true,
    /**
     * The React Compiler in Rust, inside Turbopack, which is why
     * babel-plugin-react-compiler is no longer a dependency.
     */
    turbopackRustReactCompiler: true,
  },

  /**
   * The document parsers only. They read files and reach for Node built-ins, so
   * bundling them is pointless work. pdf-parse was named here after it had been
   * replaced by unpdf, which is a setting pointing at nothing.
   *
   * The LangChain packages are deliberately not here. They were, while the model
   * layer used initChatModel's dynamic import; externalising @langchain/core
   * alongside a bundled copy of it then produced a second, stranger failure in
   * the provider constructor. With a static import there is nothing to externalise.
   */
  serverExternalPackages: ["unpdf", "exceljs", "mammoth"],
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

// next-env.d.ts carries these references and is gitignored, because Next
// regenerates it on every build. `tsc --noEmit` on a fresh checkout has no build
// to regenerate it from, so image imports fail to resolve in CI. This file is the
// tracked copy of the references that matter outside a build.
/// <reference types="next/image-types/global" />

/**
 * A side-effect stylesheet import. TypeScript 7 refuses one without a
 * declaration, where 5 ignored it.
 */
declare module "*.css";

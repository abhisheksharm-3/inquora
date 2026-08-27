// next-env.d.ts carries these references and is gitignored, because Next
// regenerates it on every build. `tsc --noEmit` on a fresh checkout has no build
// to regenerate it from, so image imports fail to resolve in CI. This file is the
// tracked copy of the one reference that matters outside a build.
/// <reference types="next/image-types/global" />

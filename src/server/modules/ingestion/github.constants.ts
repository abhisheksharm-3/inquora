/**
 * The limits repository ingestion works within, in one place so they can be read
 * and argued with rather than found scattered through the reader.
 */

/** Extensions worth storing. Everything else is build output a search would return instead of an answer. */
export const INDEXABLE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "php",
  "sql",
  "sh",
  "md",
  "mdx",
  "txt",
  "yml",
  "yaml",
  "toml",
  "json",
]);

/** Directories that hold generated or vendored code. */
export const SKIPPED_PATHS =
  /(^|\/)(node_modules|\.git|dist|build|out|target|vendor|\.next|coverage|__pycache__|\.venv)\//;

/** A file above this is minified, generated, or a lockfile. */
export const MAX_FILE_BYTES = 200_000;

/**
 * Files stored per repository. Higher than the first version's four hundred,
 * because storing a file is now a row rather than an embedding call: the cost
 * that used to scale with file count no longer does.
 */
export const MAX_FILES = 2_000;

/** Files per insert, so one repository is a handful of statements rather than two thousand. */
export const FILE_BATCH = 100;

/** GitHub's own limit is sixty an hour unauthenticated, which one repository can exhaust. */
export const GITHUB_TIMEOUT_MS = 120_000;

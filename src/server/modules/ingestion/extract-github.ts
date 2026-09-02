import JSZip from "jszip";
import { chunkCode, languageOf } from "@/core/chunk-code";
import { AppError } from "@/core/errors";
import { err, ok, type Result } from "@/core/result";
import type { Chunk } from "@/core/chunking.types";
import type { Outline } from "@/core/outline.types";

/**
 * A repository, read as one zipball rather than one request per file.
 *
 * GitHub's contents API needs a call per file, which for a repository of any size
 * is hundreds of requests against a rate limit of sixty an hour unauthenticated.
 * The zipball is one request, and jszip is already a dependency.
 */

/** Files worth indexing. Everything else is noise a search would return instead of an answer. */
const INDEXABLE = new Set([
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
  "yml",
  "yaml",
  "toml",
  "json",
]);

/** Directories that are build output or vendored code. */
const SKIP =
  /(^|\/)(node_modules|\.git|dist|build|out|target|vendor|\.next|coverage|__pycache__)\//;

/** A file above this is generated, minified or a lockfile. */
const MAX_FILE_BYTES = 200_000;

/** A repository above this many files is truncated, so one document cannot cost a whole budget. */
const MAX_FILES = 400;

/**
 * A cap on the text kept for grep. Measured on supabase/supabase-js: 399 files
 * came to 3.1MB, which is more than one column should carry and more than a regex
 * should scan on every call. Grep covers the first megabyte; search covers all of
 * it, because every file is chunked and embedded either way.
 */
const MAX_RETAINED_TEXT = 1_000_000;

export interface Repository {
  owner: string;
  name: string;
  ref?: string;
}

/** github.com/owner/name, with or without a ref, and tolerant of a .git suffix. */
export const parseRepositoryUrl = (raw: string): Result<Repository, AppError> => {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return err(AppError.badRequest("that is not a repository URL"));
  }

  if (url.hostname !== "github.com") {
    return err(AppError.badRequest("only github.com repositories are supported"));
  }

  const [owner, name, kind, ref] = url.pathname.replace(/^\//, "").split("/");

  if (!owner || !name) return err(AppError.badRequest("that URL names no repository"));

  return ok({
    owner,
    name: name.replace(/\.git$/, ""),
    ref: kind === "tree" && ref ? ref : undefined,
  });
};

export const extractRepository = async (
  repository: Repository,
  token?: string,
): Promise<Result<{ chunks: Chunk[]; outline: Outline; text: string }, AppError>> => {
  const ref = repository.ref ?? "HEAD";
  const url = `https://api.github.com/repos/${repository.owner}/${repository.name}/zipball/${ref}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "inquora",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (cause) {
    return err(
      AppError.badGateway(
        `could not reach GitHub: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }

  if (response.status === 404) {
    return err(AppError.notFound("that repository is private or does not exist"));
  }

  if (response.status === 403) {
    return err(
      AppError.rateLimited(
        3600,
        "GitHub is rate limiting. Set GITHUB_TOKEN to raise the limit from sixty an hour.",
      ),
    );
  }

  if (!response.ok) return err(AppError.badGateway(`GitHub returned ${response.status}`));

  const zip = await JSZip.loadAsync(await response.arrayBuffer());

  const chunks: Chunk[] = [];
  const files: { path: string; lines: number }[] = [];
  const parts: string[] = [];

  // The zipball nests everything under `owner-name-sha/`, which is noise in every
  // path a citation would show.
  const strip = (path: string) => path.slice(path.indexOf("/") + 1);

  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({ entry, path: strip(entry.name) }))
    .filter(({ path }) => !SKIP.test(path))
    .filter(({ path }) => INDEXABLE.has(path.slice(path.lastIndexOf(".") + 1).toLowerCase()))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_FILES);

  if (entries.length === 0) {
    return err(AppError.badRequest("that repository holds no files this can index"));
  }

  for (const { entry, path } of entries) {
    const content = await entry.async("string");

    if (content.length > MAX_FILE_BYTES) continue;

    const language = languageOf(path);
    const fileChunks = chunkCode({ path, language, content }, chunks.length);

    chunks.push(...fileChunks);
    files.push({ path, lines: content.split("\n").length });
    // The retained text keeps its path headers, so grep_document reports which
    // file a match came from.
    parts.push(`=== ${path} ===\n${content}`);
  }

  const text = parts.join("\n\n");

  return ok({
    chunks,
    outline: { files, characters: text.length },
    text:
      text.length > MAX_RETAINED_TEXT
        ? `${text.slice(0, MAX_RETAINED_TEXT)}\n\n=== truncated: ${files.length} files, ${text.length} characters, grep covers the first ${MAX_RETAINED_TEXT} ===`
        : text,
  });
};

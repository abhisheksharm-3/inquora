import { strFromU8, unzipSync } from "fflate";
import { chunkCodeFile, languageOf } from "@/core/chunking/code";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import {
  GITHUB_TIMEOUT_MS,
  INDEXABLE_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILES,
  SKIPPED_PATHS,
} from "./github.constants";
import type { ExtractedFile, ExtractedRepository, Repository } from "./ingestion.types";

/**
 * A repository, read as one zipball rather than one request per file.
 *
 * The contents API needs a call per file, which against a rate limit of sixty an
 * hour rules out any repository worth reading. The zipball is one request.
 *
 * What comes back is files, not chunks. Files answer the exact questions — where
 * is this called, what raises this error — through grep and read_file, with no
 * vector involved. Chunks are spent only on what describes the code: its
 * documentation, and the declarations that say what each file contains.
 */

/** github.com/owner/name, with or without a ref, tolerant of a .git suffix. */
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
): Promise<Result<ExtractedRepository, AppError>> => {
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
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
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

  // The zipball nests everything under `owner-name-sha/`, which is noise in every
  // path a citation would show.
  const strip = (name: string) => name.slice(name.indexOf("/") + 1);

  const indexable = (name: string) => {
    if (name.endsWith("/")) return false;

    const path = strip(name);

    return (
      !SKIPPED_PATHS.test(path) &&
      INDEXABLE_EXTENSIONS.has(path.slice(path.lastIndexOf(".") + 1).toLowerCase())
    );
  };

  // Filtering during the unzip rather than after it: a repository zipball is
  // mostly files this will never index, and inflating them to discard them is the
  // expensive part.
  let unzipped: Record<string, Uint8Array>;

  try {
    unzipped = unzipSync(new Uint8Array(await response.arrayBuffer()), {
      filter: (file) => indexable(file.name),
    });
  } catch (cause) {
    return err(
      AppError.badGateway(
        `that zipball could not be read: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }

  const entries = Object.keys(unzipped)
    .map((name) => ({ name, path: strip(name) }))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_FILES);

  if (entries.length === 0) {
    return err(AppError.badRequest("that repository holds no files this can index"));
  }

  const files: ExtractedFile[] = [];
  const chunks = [];

  for (const { name, path } of entries) {
    if (unzipped[name].byteLength > MAX_FILE_BYTES) continue;

    const content = strFromU8(unzipped[name]);

    if (content.trim().length === 0) continue;

    const language = languageOf(path);
    const lineCount = content.split("\n").length;

    files.push({ path, language, content, lineCount, bytes: content.length });
    chunks.push(...chunkCodeFile({ path, language, content }, chunks.length));
  }

  if (files.length === 0) {
    return err(AppError.badRequest("every file in that repository was too large or empty"));
  }

  return ok({
    files,
    chunks,
    outline: {
      files: files.map((file) => ({ path: file.path, lines: file.lineCount })),
      characters: files.reduce((total, file) => total + file.bytes, 0),
    },
  });
};

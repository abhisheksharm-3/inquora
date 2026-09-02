import { lookup } from "node:dns/promises";
import { AppError } from "@/core/errors";
import { err, ok } from "@/core/result";
import type { Result } from "@/core/result.types";
import { isPrivateAddress } from "@/core/untrusted/ip-range";
import { FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_REDIRECTS } from "./http.constants";
import type { CheckedUrl } from "./http.types";

/**
 * Fetches a URL that somebody else chose.
 *
 * A document can name a source URL, and the worker that reads it holds a
 * service-role client and sits inside the deployment's network. Fetching that URL
 * unchecked is server-side request forgery: the address can name the cloud
 * metadata endpoint, a database on a private subnet, or something on loopback.
 *
 * Four rules: https only, no credentials in the URL, every resolved address
 * checked against the private ranges, and redirects followed by hand so a public
 * URL cannot bounce to a private one.
 *
 * The fifth problem is DNS rebinding. Validating the hostname and then calling
 * fetch resolves it twice, and an attacker controlling the name server can answer
 * the second lookup with a private address. So the connection is pinned: the
 * socket is opened to the address that was validated, using a lookup that refuses
 * to return anything else, while the URL keeps its hostname so TLS and the
 * certificate still verify against the real name.
 */

const assertPublic = async (raw: string): Promise<Result<CheckedUrl, AppError>> => {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return err(AppError.badRequest("that is not a valid URL"));
  }

  if (url.protocol !== "https:") {
    return err(AppError.badRequest("only https URLs can be fetched"));
  }

  if (url.username || url.password) {
    return err(AppError.badRequest("a URL with credentials in it will not be fetched"));
  }

  let addresses: { address: string; family: number }[];

  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return err(AppError.badRequest(`${url.hostname} does not resolve`));
  }

  // Every address, not the first: a hostname answering with one public and one
  // private address must not be reachable through the private one.
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    return err(AppError.badRequest(`${url.hostname} resolves to an address that is not public`));
  }

  return ok({ url, addresses });
};

/**
 * A dispatcher whose DNS lookup can only return the addresses already validated.
 * This is what closes the window between checking a name and connecting to it.
 */
const pinnedDispatcher = async (checked: CheckedUrl) => {
  const { Agent } = await import("undici");

  return new Agent({
    connect: {
      lookup: (
        _hostname: string,
        _options: unknown,
        callback: (error: Error | null, addresses: { address: string; family: number }[]) => void,
      ) => callback(null, checked.addresses),
    },
  });
};

/** Reads a body, giving up the moment it exceeds what the caller will accept. */
const readWithinBudget = async (
  response: Response,
  budget: number,
): Promise<Result<string, AppError>> => {
  if (!response.body) return ok("");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let read = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      read += value.byteLength;

      if (read > budget) {
        await reader.cancel().catch(() => {});
        return err(AppError.badRequest("that page is larger than 10MB"));
      }

      parts.push(decoder.decode(value, { stream: true }));
    }
  } catch (cause) {
    return err(
      AppError.badGateway(
        `that URL stopped sending: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    );
  }

  parts.push(decoder.decode());

  return ok(parts.join(""));
};

export const fetchExternal = async (
  raw: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Result<{ text: string; url: string }, AppError>> => {
  let target = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = await assertPublic(target);
    if (!checked.ok) return err(checked.error);

    let response: Response;
    const dispatcher = await pinnedDispatcher(checked.value);

    try {
      response = await fetch(checked.value.url, {
        // Manual, so every hop is validated before it is taken.
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.8" },
        dispatcher,
        // `dispatcher` is undici's, which is what Node's fetch is built on. It is
        // not in the DOM RequestInit type.
      } as RequestInit & { dispatcher: unknown });
    } catch (cause) {
      await dispatcher.close().catch(() => {});

      return err(
        AppError.badGateway(
          `could not fetch that URL: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }

    // Each hop opens its own pinned connection pool. Without this a drain over
    // five URL documents leaked a pool per hop inside one warm function.
    const done = async <T>(result: T): Promise<T> => {
      await dispatcher.close().catch(() => {});
      return result;
    };

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return done(err(AppError.badGateway("that URL redirected to nowhere")));

      target = new URL(location, checked.value.url).toString();
      await dispatcher.close().catch(() => {});
      continue;
    }

    if (!response.ok) {
      return done(err(AppError.badGateway(`that URL returned ${response.status}`)));
    }

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_FETCH_BYTES) {
      return done(err(AppError.badRequest("that page is larger than 10MB")));
    }

    /*
     * Read with a running budget rather than buffering and then measuring.
     *
     * A declared content-length is only present when the server volunteers one:
     * omit it, or use chunked encoding, and `Number(null ?? 0)` is zero, the check
     * above passes, and `response.text()` used to buffer the whole body before
     * anything measured it. A user-supplied URL that streams gigabytes was an
     * out-of-memory kill on the worker, followed by a retry.
     */
    const read = await readWithinBudget(response, MAX_FETCH_BYTES);

    if (!read.ok) return done(err(read.error));

    return done(ok({ text: read.value, url: checked.value.url.toString() }));
  }

  return err(AppError.badGateway("that URL redirected too many times"));
};

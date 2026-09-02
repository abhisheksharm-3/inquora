import { lookup } from "node:dns/promises";
import { AppError } from "@/core/errors";
import { isPrivateAddress } from "@/core/ip-range";
import { err, ok, type Result } from "@/core/result";
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

const MAX_REDIRECTS = 3;
const MAX_BYTES = 10 * 1024 * 1024;

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

export const fetchExternal = async (
  raw: string,
  timeoutMs = 30_000,
): Promise<Result<{ text: string; url: string }, AppError>> => {
  let target = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = await assertPublic(target);
    if (!checked.ok) return err(checked.error);

    let response: Response;

    try {
      response = await fetch(checked.value.url, {
        // Manual, so every hop is validated before it is taken.
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.8" },
        dispatcher: await pinnedDispatcher(checked.value),
        // `dispatcher` is undici's, which is what Node's fetch is built on. It is
        // not in the DOM RequestInit type.
      } as RequestInit & { dispatcher: unknown });
    } catch (cause) {
      return err(
        AppError.badGateway(
          `could not fetch that URL: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return err(AppError.badGateway("that URL redirected to nowhere"));

      target = new URL(location, checked.value.url).toString();
      continue;
    }

    if (!response.ok) return err(AppError.badGateway(`that URL returned ${response.status}`));

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      return err(AppError.badRequest("that page is larger than 10MB"));
    }

    const text = await response.text();

    if (text.length > MAX_BYTES) {
      return err(AppError.badRequest("that page is larger than 10MB"));
    }

    return ok({ text, url: checked.value.url.toString() });
  }

  return err(AppError.badGateway("that URL redirected too many times"));
};

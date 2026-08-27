import { lookup } from "node:dns/promises";
import { AppError } from "@/core/errors";
import { isPrivateAddress } from "@/core/ip-range";
import { err, ok, type Result } from "@/core/result";

/**
 * Fetches a URL that somebody else chose.
 *
 * A document can name a source URL, and the worker that reads it holds a
 * service-role client and sits inside the deployment's network. Fetching that URL
 * unchecked is server-side request forgery: the address can name the cloud
 * metadata endpoint, a database on a private subnet, or something on loopback.
 *
 * So: https only, no credentials in the URL, every resolved address checked
 * against the private ranges, and redirects followed by hand so a public URL
 * cannot bounce to a private one.
 */

const MAX_REDIRECTS = 3;
const MAX_BYTES = 10 * 1024 * 1024;

const assertPublic = async (raw: string): Promise<Result<URL, AppError>> => {
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

  let addresses: { address: string }[];

  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    return err(AppError.badRequest(`${url.hostname} does not resolve`));
  }

  // Every address, not the first: a hostname that resolves to one public and one
  // private address must not be reachable through the private one.
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    return err(AppError.badRequest(`${url.hostname} resolves to an address that is not public`));
  }

  return ok(url);
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
      response = await fetch(checked.value, {
        // Manual, so each hop is checked before it is taken.
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.8" },
      });
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

      target = new URL(location, checked.value).toString();
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

    return ok({ text, url: checked.value.toString() });
  }

  return err(AppError.badGateway("that URL redirected too many times"));
};

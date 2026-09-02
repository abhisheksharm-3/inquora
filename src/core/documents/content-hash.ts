/**
 * The identity of a document's bytes. Re-uploading the same file reuses its
 * chunks instead of paying to embed them again, which is what the unique index
 * on (user_id, content_hash) enforces.
 *
 * crypto.subtle.digest rather than a hash package: it is in the platform.
 */
export const contentHash = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

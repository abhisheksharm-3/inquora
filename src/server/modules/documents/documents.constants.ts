/** The private storage bucket uploaded files live in. Named once, used by both sides. */
export const STORAGE_BUCKET = "documents";

/** The same fifty megabytes the bucket and the upload schema both enforce. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

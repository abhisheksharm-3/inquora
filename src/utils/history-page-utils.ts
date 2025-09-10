/**
 * Converts a file size in bytes to a human-readable string with appropriate units (B, KB, MB, GB).
 *
 * @param {number} bytes - The file size in bytes.
 * @param {number} [decimals=1] - The number of decimal places to include.
 * @returns {string} The formatted file size string (e.g., "1.5 MB").
 */
export const formatFileSize = (bytes: number, decimals: number = 1): string => {
  if (!bytes || bytes <= 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure we don't go beyond the defined sizes array
  const unit = sizes[i] || sizes[sizes.length - 1];

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${unit}`;
};

/**
 * Formats an ISO date string into a relative "time ago" format (e.g., "5 minutes ago").
 * This function uses the modern Intl.RelativeTimeFormat API for accurate, localized formatting.
 *
 * @param {string} dateString - The ISO date string to format.
 * @returns {string} The relative time string or a locale date string if older than a week.
 */
export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

  // Define time units in seconds
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;

  // Use Intl.RelativeTimeFormat for modern, clean, and internationalized output
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffInSeconds) < minute) {
    return rtf.format(-diffInSeconds, "second");
  }
  if (Math.abs(diffInSeconds) < hour) {
    return rtf.format(-Math.floor(diffInSeconds / minute), "minute");
  }
  if (Math.abs(diffInSeconds) < day) {
    return rtf.format(-Math.floor(diffInSeconds / hour), "hour");
  }
  if (Math.abs(diffInSeconds) < week) {
    return rtf.format(-Math.floor(diffInSeconds / day), "day");
  }

  // Fallback for dates older than a week
  return date.toLocaleDateString();
};

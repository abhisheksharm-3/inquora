/**
 * Input sanitization utilities.
 */

/**
 * Sanitizes a user query string by removing potentially harmful content.
 * @param query - The raw user query
 * @returns Sanitized query string
 */
export function sanitizeUserQuery(query: string): string {
    if (!query || typeof query !== "string") {
        return "";
    }

    return query
        // Remove null bytes
        .replace(/\0/g, "")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Trim
        .trim()
        // Limit length to prevent DoS
        .slice(0, 10000);
}

/**
 * Sanitizes a URL string by validating format and removing dangerous schemes.
 * @param url - The raw URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
    if (!url || typeof url !== "string") {
        return "";
    }

    const trimmedUrl = url.trim();

    try {
        const parsedUrl = new URL(trimmedUrl);

        // Only allow safe protocols
        const allowedProtocols = ["http:", "https:"];
        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            return "";
        }

        return parsedUrl.href;
    } catch {
        return "";
    }
}

/**
 * Sanitizes a filename by removing path traversal and dangerous characters.
 * @param filename - The raw filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== "string") {
        return "unnamed_file";
    }

    return filename
        // Remove path traversal
        .replace(/\.\./g, "")
        .replace(/[/\\]/g, "")
        // Remove null bytes
        .replace(/\0/g, "")
        // Remove control characters
        .replace(/[\x00-\x1f\x7f]/g, "")
        // Limit length
        .slice(0, 255)
        .trim() || "unnamed_file";
}

/**
 * Sanitizes an email address.
 * @param email - The raw email string
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
    if (!email || typeof email !== "string") {
        return "";
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        return "";
    }

    return trimmedEmail.slice(0, 254); // RFC 5321 limit
}

/**
 * Sanitizes HTML content by escaping dangerous characters.
 * Use this for displaying user content in the UI.
 * @param html - The raw HTML string
 * @returns Escaped HTML string
 */
export function escapeHtml(html: string): string {
    if (!html || typeof html !== "string") {
        return "";
    }

    const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;",
    };

    return html.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
}

/**
 * Sanitizes error messages to prevent information disclosure.
 * @param error - The raw error
 * @returns Safe error message for client display
 */
export function sanitizeErrorMessage(error: unknown): string {
    // Don't expose internal error details
    if (error instanceof Error) {
        // Check for common safe error types
        const safePatterns = [
            /invalid.*url/i,
            /file.*not.*found/i,
            /permission.*denied/i,
            /rate.*limit/i,
            /quota.*exceeded/i,
            /network.*error/i,
            /timeout/i,
        ];

        for (const pattern of safePatterns) {
            if (pattern.test(error.message)) {
                return error.message;
            }
        }
    }

    // Generic safe message for other errors
    return "An unexpected error occurred. Please try again.";
}

/**
 * Validates and sanitizes a YouTube video ID.
 * @param videoId - The raw video ID
 * @returns Sanitized video ID or null if invalid
 */
export function sanitizeYoutubeVideoId(videoId: string): string | null {
    if (!videoId || typeof videoId !== "string") {
        return null;
    }

    const trimmed = videoId.trim();

    // YouTube video IDs are exactly 11 characters, alphanumeric with _ and -
    const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (!youtubeIdRegex.test(trimmed)) {
        return null;
    }

    return trimmed;
}

/**
 * Validates and sanitizes a GitHub repository URL.
 * @param url - The raw GitHub URL
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeGitHubUrl(url: string): string | null {
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
        return null;
    }

    try {
        const parsedUrl = new URL(sanitizedUrl);

        // Must be github.com
        if (!parsedUrl.hostname.endsWith("github.com")) {
            return null;
        }

        // Must have owner/repo pattern
        const pathMatch = parsedUrl.pathname.match(/^\/([^/]+)\/([^/]+)/);
        if (!pathMatch) {
            return null;
        }

        return sanitizedUrl;
    } catch {
        return null;
    }
}

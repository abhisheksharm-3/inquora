// Client-safe web scraping utilities (no server-side dependencies)

/**
 * Validates if a URL is a valid web page URL that can be scraped
 * This is safe to use on the client side
 */
export const validateWebUrl = (url: string): boolean => {
  console.log(`Validating web URL: ${url}`);

  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const urlObj = new URL(url);

    // Must use HTTP or HTTPS protocol
    if (!urlObj.protocol.startsWith("http")) {
      return false;
    }

    // Exclude certain domains/URLs that are typically not scrapeable
    const excludedPatterns = [
      // Social media login/auth pages
      /login|signin|auth|oauth/i,
      // File downloads
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|exe|dmg)$/i,
      // Media files
      /\.(jpg|jpeg|png|gif|svg|mp4|mp3|wav|avi|mov)$/i,
      // API endpoints
      /\/api\/|\/graphql/i,
      // Admin panels
      /\/admin\/|\/wp-admin\//i,
    ];

    const urlString = url.toLowerCase();
    for (const pattern of excludedPatterns) {
      if (pattern.test(urlString)) {
        console.log(`URL validation failed - matches excluded pattern: ${pattern}`);
        return false;
      }
    }

    console.log(`URL validation passed: ${url}`);
    return true;
  } catch (error) {
    console.log(`URL validation failed - invalid URL: ${error}`);
    return false;
  }
};

/**
 * Alternative export for compatibility
 */
export const isValidWebUrl = validateWebUrl;

/**
 * Extracts domain from URL for categorization
 */
export const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
};

/**
 * Generates a page ID from URL for consistent identification
 */
export const generatePageId = (url: string): string => {
  // Create a simple hash-like ID from the URL
  const cleanUrl = url.replace(/[^a-zA-Z0-9]/g, "");
  const timestamp = Date.now().toString(36);
  return `web_${cleanUrl.slice(-16)}_${timestamp}`;
};

/**
 * Cleans and normalizes URLs for processing
 */
export const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove fragment and normalize
    urlObj.hash = "";
    // Sort query parameters for consistency
    urlObj.searchParams.sort();
    return urlObj.toString();
  } catch {
    return url;
  }
};

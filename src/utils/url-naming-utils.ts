export const _getHostnameFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "Web Page";
  }
};

export const _extractGitHubFilename = async (url: string): Promise<string> => {
  try {
    const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/i);
    if (githubMatch) {
      const [, owner, repo] = githubMatch;
      return `${owner}/${repo.replace(/\.git$/, "")}`;
    }
  } catch {
    // Ignore error, fallback to hostname
  }
  return _getHostnameFromUrl(url);
};

export const _extractWebPageTitle = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        let pageTitle = titleMatch[1].replace(/\s*[-|]\s*.+$/, "").trim();
        if (pageTitle.length > 60) {
          pageTitle = pageTitle.substring(0, 60) + "...";
        }
        return pageTitle;
      }
    }
  } catch {
    // Fallback to URL-based naming
  }

  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0) {
      return pathSegments[pathSegments.length - 1]
        .replace(/[-_]/g, " ")
        .replace(/\.(html?|php|asp|jsp)$/i, "");
    }
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "Web Page";
  }
};

/**
 * Extracts the title of a YouTube video from its URL.
 * Uses youtubei.js to fetch the actual video title.
 */
export const _extractYoutubeTitle = async (url: string): Promise<string> => {
  try {
    // Extract video ID from URL
    const videoIdMatch = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );

    if (!videoIdMatch) {
      return "YouTube Video";
    }

    const videoId = videoIdMatch[1];

    // Import dynamically to avoid issues with server/client
    const { getYoutubeVideoInfo } = await import("./youtube/transcript");
    const info = await getYoutubeVideoInfo(videoId);

    // Use the actual video title
    let title = info.title || `YouTube Video ${videoId}`;

    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 60) + "...";
    }

    return title;
  } catch {
    return "YouTube Video";
  }
};

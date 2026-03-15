// Types for web page scraping functionality

// --- Core Result Types ---
export interface TypeWebPageInfo {
  id: string;
  title: string;
  url: string;
  description?: string;
  domain: string;
}

export interface TypeWebScrapingResult {
  numDocs: number;
  success: boolean;
  error?: string;
}

// --- Internal Types ---
export interface TypeWebPageContent {
  title: string;
  content: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    publishDate?: string;
    domain: string;
    url: string;
  };
}

// --- Hook Types ---
export interface TypeUseWebScrapingReturn {
  validateUrl: (url: string) => boolean;
  getPageInfo: (url: string) => Promise<TypeWebPageInfo>;
  processPage: {
    mutate: (variables: { url: string; fileId: string }) => void;
    mutateAsync: (variables: {
      url: string;
      fileId: string;
    }) => Promise<TypeWebScrapingResult>;
    isPending: boolean;
    error: Error | null;
    data: TypeWebScrapingResult | undefined;
    isSuccess: boolean;
    isError: boolean;
    reset: () => void;
  };
  fetchPageInfo: {
    mutate: (url: string) => void;
    mutateAsync: (url: string) => Promise<TypeWebPageInfo>;
    isPending: boolean;
    error: Error | null;
    data: TypeWebPageInfo | undefined;
    isSuccess: boolean;
    isError: boolean;
    reset: () => void;
  };
}

// --- Scraping Configuration ---
export interface TypeScrapingConfig {
  userAgent: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
}

export const DEFAULT_SCRAPING_CONFIG: TypeScrapingConfig = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  timeout: 30000,
  retries: 3,
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  },
};

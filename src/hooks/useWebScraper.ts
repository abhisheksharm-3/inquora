"use client";

import { useMutation } from "@tanstack/react-query";
import { validateWebUrl } from "@/utils/web-scraper-utils";
import { 
  getWebPageInfo, 
  processWebPage 
} from "@/utils/processors/web-scraper-server";
import type { 
  TypeUseWebScrapingReturn
} from "@/types/TypeWebScraper";

/**
 * Custom hook for managing web page scraping operations
 * 
 * Provides functionality to:
 * - Validate web page URLs
 * - Fetch page information by scraping
 * - Process pages for vectorization
 * 
 * Uses advanced web scraping with content cleaning and extraction!
 */
export const useWebScraper = (): TypeUseWebScrapingReturn => {
  
  // --- Mutations ---
  
  /**
   * Mutation for processing a web page
   */
  const processPageMutation = useMutation({
    mutationFn: async ({ url, fileId }: { url: string; fileId: string }) => {
      console.log('Processing web page:', { url, fileId });
      return await processWebPage(url, fileId);
    },
    onSuccess: (data) => {
      console.log('Web page processed successfully:', data);
    },
    onError: (error) => {
      console.error('Error processing web page:', error);
    }
  });

  /**
   * Mutation for fetching page information
   */
  const fetchPageInfoMutation = useMutation({
    mutationFn: async (url: string) => {
      console.log('Fetching web page info:', url);
      return await getWebPageInfo(url);
    },
    onSuccess: (data) => {
      console.log('Web page info fetched successfully:', data);
    },
    onError: (error) => {
      console.error('Error fetching web page info:', error);
    }
  });

  // --- Public Interface ---
  
  return {
    validateUrl: validateWebUrl,
    getPageInfo: getWebPageInfo,
    processPage: {
      mutate: processPageMutation.mutate,
      mutateAsync: processPageMutation.mutateAsync,
      isPending: processPageMutation.isPending,
      error: processPageMutation.error,
      data: processPageMutation.data,
      isSuccess: processPageMutation.isSuccess,
      isError: processPageMutation.isError,
      reset: processPageMutation.reset,
    },
    fetchPageInfo: {
      mutate: fetchPageInfoMutation.mutate,
      mutateAsync: fetchPageInfoMutation.mutateAsync,
      isPending: fetchPageInfoMutation.isPending,
      error: fetchPageInfoMutation.error,
      data: fetchPageInfoMutation.data,
      isSuccess: fetchPageInfoMutation.isSuccess,
      isError: fetchPageInfoMutation.isError,
      reset: fetchPageInfoMutation.reset,
    },
  };
};

// Export default
export default useWebScraper;

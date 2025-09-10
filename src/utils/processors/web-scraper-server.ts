"use server";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createGeminiEmbeddings } from "../gemini/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex, isPineconeConfigured } from "../pinecone";
import { Document } from "langchain/document";
import { updateFileStatus } from "../file-processing-utils";
import { supabaseBrowserClient } from "../supabase/client";
import * as cheerio from 'cheerio';
import type { 
  TypeWebScrapingResult, 
  TypeWebPageInfo, 
  TypeWebPageContent,
  TypeScrapingConfig
} from "@/types/TypeWebScraper";
import { DEFAULT_SCRAPING_CONFIG } from "@/types/TypeWebScraper";
import { 
  getDomainFromUrl, 
  generatePageId, 
  normalizeUrl 
} from "../web-scraper-utils";

// --- Constants ---
const CHUNK_SIZE = 1500; // Increased chunk size for better context
const CHUNK_OVERLAP = 300; // Increased overlap for better continuity
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Scrapes content from a web page with enhanced content extraction
 * @private
 */
const _scrapeWebPage = async (
  url: string, 
  config: TypeScrapingConfig = DEFAULT_SCRAPING_CONFIG
): Promise<TypeWebPageContent> => {
  console.log(`Scraping web page: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': config.userAgent,
        ...config.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`Invalid content type: ${contentType}. Only HTML pages are supported.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements and other noise
    $('script, style, nav, header, footer, aside, .navigation, .sidebar, .menu, .ad, .advertisement, .cookie, .popup, .modal, .overlay').remove();
    
    // Also remove common ad/tracking elements
    $('[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"], .google-ads, .adsense').remove();

    // Extract title with fallbacks
    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    if (!title) {
      title = 'Untitled Page';
    }

    // Clean title
    title = title.replace(/\s*[-|]\s*.+$/, '').trim(); // Remove site name from title
    
    // Extract description
    let description = $('meta[name="description"]').attr('content') || '';
    if (!description) {
      description = $('meta[property="og:description"]').attr('content') || '';
    }

    // Extract keywords
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    // Extract author
    const author = $('meta[name="author"]').attr('content') || 
                  $('meta[property="article:author"]').attr('content') || '';

    // Extract publish date
    const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                       $('time[datetime]').attr('datetime') || '';

    // Enhanced content extraction strategy with multiple approaches
    let content = '';
    
    // Strategy 1: Look for main content areas with priority order
    const mainContentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      'article',
      '.prose', // Common for documentation sites
      '.markdown-body', // GitHub-style
      '.container .row .col', // Bootstrap-style layouts
    ];

    for (const selector of mainContentSelectors) {
      const mainElement = $(selector).first();
      if (mainElement.length > 0) {
        content = mainElement.text().trim();
        if (content.length > 500) { // Substantial content found
          break;
        }
      }
    }

    // Strategy 2: Extract from structured content if main content is insufficient
    if (content.length < 500) {
      const structuredSelectors = [
        'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code',
        '.content p, .content h1, .content h2, .content h3',
        'article p, article h1, article h2, article h3',
      ];
      
      for (const selector of structuredSelectors) {
        const elements = $(selector);
        const extractedTexts: string[] = [];
        
        elements.each((_: number, element: cheerio.Element) => {
          const text = $(element).text().trim();
          if (text.length > 20 && !extractedTexts.some(existing => existing.includes(text) || text.includes(existing))) {
            extractedTexts.push(text);
          }
        });
        
        if (extractedTexts.length > 0) {
          content = extractedTexts.join('\n\n');
          if (content.length > 500) {
            break;
          }
        }
      }
    }

    // Strategy 3: Fallback to body text but with better filtering
    if (content.length < 200) {
      content = $('body').text().trim();
    }

    // Enhanced content cleaning and processing
    content = content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/\b(cookie|privacy|terms|subscribe|newsletter|advertisement)\b.*$/gim, '') // Remove common noise
      .trim();

    // Add context information to make content more comprehensive
    const contextualContent = [];
    
    // Add title and description as context
    if (title && title !== 'Untitled Page') {
      contextualContent.push(`Page Title: ${title}`);
    }
    
    if (description) {
      contextualContent.push(`Page Description: ${description}`);
    }
    
    // Extract key headings for structure
    const headings: string[] = [];
    $('h1, h2, h3').each((_: number, element: cheerio.Element) => {
      const heading = $(element).text().trim();
      if (heading && heading.length > 3 && heading.length < 100) {
        headings.push(heading);
      }
    });
    
    if (headings.length > 0) {
      contextualContent.push(`Key Topics: ${headings.slice(0, 10).join(' | ')}`);
    }
    
    // Combine contextual information with main content
    if (contextualContent.length > 0) {
      content = contextualContent.join('\n') + '\n\n' + content;
    }

    // Validate content quality
    if (content.length < 100) {
      throw new Error('Not enough meaningful content extracted from the page. The page might be empty, require authentication, or be heavily JavaScript-dependent.');
    }

    // Check for common "no content" indicators
    const noContentIndicators = [
      'page not found',
      '404 error',
      'access denied',
      'please enable javascript',
      'login required',
      'subscription required'
    ];

    const lowerContent = content.toLowerCase();
    for (const indicator of noContentIndicators) {
      if (lowerContent.includes(indicator)) {
        throw new Error(`Page appears to have access restrictions or errors: ${indicator}`);
      }
    }

    const domain = getDomainFromUrl(url);

    const result: TypeWebPageContent = {
      title: title.slice(0, 200), // Limit title length
      content,
      metadata: {
        description: description.slice(0, 500), // Limit description length
        keywords,
        author,
        publishDate,
        domain,
        url: normalizeUrl(url),
      }
    };

    console.log(`Successfully scraped page. Title: "${result.title}", Content length: ${content.length} characters, Domain: ${domain}`);
    
    return result;
    
  } catch (error) {
    console.error('Error scraping web page:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: The page took too long to load (>${config.timeout/1000}s)`);
      }
      if (error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to the website. The site might be down or blocking requests.`);
      }
    }
    
    throw new Error(`Failed to scrape web page: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Delays execution for rate limiting
 * @private
 */
const _delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry wrapper for operations
 * @private
 */
const _withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${delay}ms...`);
        await _delay(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError!;
};

/**
 * Server action: Fetches basic page information using web scraping
 */
export const getWebPageInfo = async (url: string): Promise<TypeWebPageInfo> => {
  console.log(`Getting web page info for: ${url}`);
  
  try {
    const pageContent = await _withRetry(() => _scrapeWebPage(url));
    
    const pageInfo: TypeWebPageInfo = {
      id: generatePageId(url),
      title: pageContent.title,
      url: normalizeUrl(url),
      description: pageContent.metadata.description,
      domain: pageContent.metadata.domain,
    };
    
    console.log(`Successfully fetched page info:`, pageInfo);
    return pageInfo;
  } catch (error) {
    console.error("Error fetching page info:", error);
    throw new Error(`Failed to fetch page info: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Server action: Processes a web page and stores it in vector database
 */
export const processWebPage = async (
  url: string,
  fileId: string
): Promise<TypeWebScrapingResult> => {
  console.log(`Processing web page: ${url} for file: ${fileId}`);
  
  try {
    // Validate inputs
    if (!url || !fileId) {
      throw new Error("Missing required parameters");
    }
    
    if (!isPineconeConfigured()) {
      throw new Error("Pinecone is not configured");
    }
    
    // Get user ID from file record
    const supabase = supabaseBrowserClient();
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("user_id")
      .eq("id", fileId)
      .single();
    
    if (fileError || !file) {
      throw new Error(`Failed to get file record: ${fileError?.message || 'File not found'}`);
    }
    
    const userId = file.user_id;
    
    // Update status to processing
    await updateFileStatus(supabase, fileId, "processing");
    
    // Scrape content with retry logic
    const pageContent = await _withRetry(() => _scrapeWebPage(url));
    
    // Create text splitter
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    
    // Split the content into chunks
    const texts = await textSplitter.splitText(pageContent.content);
    console.log(`Split content into ${texts.length} chunks`);
    
    if (texts.length === 0) {
      throw new Error("No content found after text splitting");
    }
    
    // Create documents with enhanced metadata for better AI understanding
    const documents = texts.map((text, index) => {
      // Enhance each chunk with context
      let enhancedText = text;
      
      // Add document context to first chunk
      if (index === 0) {
        const contextPrefix = [
          `Source: ${pageContent.metadata.url}`,
          `Title: ${pageContent.title}`,
          pageContent.metadata.description ? `Description: ${pageContent.metadata.description}` : null,
          pageContent.metadata.domain ? `Domain: ${pageContent.metadata.domain}` : null,
        ].filter(Boolean).join('\n');
        
        enhancedText = `${contextPrefix}\n\nContent:\n${text}`;
      }
      
      return new Document({
        pageContent: enhancedText,
        metadata: {
          fileId,
          userId,
          source: pageContent.metadata.url,
          title: pageContent.title,
          type: "web",
          domain: pageContent.metadata.domain,
          description: pageContent.metadata.description,
          keywords: pageContent.metadata.keywords,
          author: pageContent.metadata.author,
          publishDate: pageContent.metadata.publishDate,
          chunkIndex: index,
          totalChunks: texts.length,
          timestamp: new Date().toISOString(),
          // Additional context for AI
          contentType: 'webpage',
          isMainContent: index === 0 ? 'true' : 'false',
          searchableText: `${pageContent.title} ${pageContent.metadata.description || ''} ${text}`.toLowerCase(),
        },
      });
    });
    
    // Create embeddings and store in Pinecone
    const embeddings = await createGeminiEmbeddings();
    const pineconeIndex = await getPineconeIndex();
    
    console.log(`Storing ${documents.length} documents in Pinecone...`);
    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex,
      namespace: fileId, // Use fileId as namespace for consistency with other processors
    });
    
    // Update file status to completed
    await updateFileStatus(supabase, fileId, "completed");
    
    const result: TypeWebScrapingResult = {
      numDocs: documents.length,
      success: true,
    };
    
    console.log(`Successfully processed web page:`, result);
    return result;
    
  } catch (error) {
    console.error("Error processing web page:", error);
    
    // Update file status to error
    try {
      const supabase = supabaseBrowserClient();
      await updateFileStatus(supabase, fileId, "failed");
    } catch (statusError) {
      console.error("Failed to update file status to error:", statusError);
    }
    
    return {
      numDocs: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

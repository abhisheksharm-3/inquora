"use server";

import { queryDocuments } from "../processors/query-processor";
import {
  TypeQueryAnalysis,
  TypeRetrievalResult,
  TypeRetrievalConfiguration,
  TypeContextualRetrievalOptions
} from "@/types/TypeRag";

import { findIndexForNamespace, getPineconeIndex } from "../pinecone";

/**
 * Default configuration for retrieval
 */
const DEFAULT_RETRIEVAL_CONFIG: TypeRetrievalConfiguration = {
  strategies: [
    { name: 'semantic', weight: 0.6, topK: 8, enabled: true },
    { name: 'keyword', weight: 0.3, topK: 5, enabled: true },
    { name: 'contextual', weight: 0.1, topK: 3, enabled: true }
  ],
  rerankingEnabled: true,
  diversityThreshold: 0.7,
  minimumRelevanceScore: 0.3,
  maxResults: 10,
  multiModalEnabled: true,
  crossReferenceEnabled: true,
  temporalWeighting: true
};

/**
 * Main retrieval function that orchestrates multiple strategies
 */
export async function retrieveRelevantDocuments(
  analysisResult: TypeQueryAnalysis,
  namespace: string,
  options: TypeContextualRetrievalOptions = {},
  config: TypeRetrievalConfiguration = DEFAULT_RETRIEVAL_CONFIG
): Promise<TypeRetrievalResult[]> {

  const allResults: TypeRetrievalResult[] = [];

  // Resolve Pinecone index once for all strategies
  let pineconeIndex: any;
  try {
    const indexInfo = await findIndexForNamespace(namespace);
    if (indexInfo) {
      pineconeIndex = indexInfo.index;
    } else {
      pineconeIndex = await getPineconeIndex();
    }
  } catch (error) {
    console.error("Failed to resolve Pinecone index:", error);
    // Continue without index, individual queries might fail or try their own resolution
  }

  // Execute strategies in parallel
  const searchPromises: Promise<TypeRetrievalResult[]>[] = [];

  // Strategy 1: Semantic Search (primary)
  searchPromises.push(
    performSemanticSearch(
      analysisResult.expandedQuery,
      namespace,
      config.strategies.find(s => s.name === 'semantic')?.topK || 8,
      pineconeIndex
    ).catch(error => {
      console.warn("Semantic search failed:", error);
      return [];
    })
  );

  // Strategy 2: Keyword-based search
  if (analysisResult.keywords.length > 0) {
    searchPromises.push(
      performKeywordSearch(
        analysisResult.keywords,
        namespace,
        config.strategies.find(s => s.name === 'keyword')?.topK || 5,
        pineconeIndex
      ).catch(error => {
        console.warn("Keyword search failed:", error);
        return [];
      })
    );
  }

  // Strategy 3: Contextual search (if conversation history available)
  if (options.conversationHistory && options.conversationHistory.length > 0) {
    searchPromises.push(
      performContextualSearch(
        analysisResult,
        options.conversationHistory,
        namespace,
        config.strategies.find(s => s.name === 'contextual')?.topK || 3,
        pineconeIndex
      ).catch(error => {
        console.warn("Contextual search failed:", error);
        return [];
      })
    );
  }

  // Wait for all strategies to complete
  const results = await Promise.all(searchPromises);
  results.forEach(resultGroup => allResults.push(...resultGroup));

  // Remove duplicates and apply quality filtering
  const deduplicatedResults = removeDuplicateDocuments(allResults);
  const filteredResults = filterByRelevanceScore(deduplicatedResults, config.minimumRelevanceScore);

  // Apply reranking if enabled
  const finalResults = config.rerankingEnabled
    ? await rerankResults(filteredResults, analysisResult)
    : filteredResults;

  // Apply diversity filtering and limit results
  const diverseResults = applyDiversityFiltering(finalResults, config.diversityThreshold);

  return diverseResults.slice(0, config.maxResults);
}

/**
 * Performs semantic search using vector similarity
 */
async function performSemanticSearch(
  query: string,
  namespace: string,
  topK: number,
  pineconeIndex?: any
): Promise<TypeRetrievalResult[]> {

  const documents = await queryDocuments(query, namespace, topK, pineconeIndex);

  return documents.map((doc, index) => ({
    document: doc,
    score: 1.0 - (index * 0.1), // Simple scoring based on order
    retrievalMethod: 'semantic',
    relevanceReason: 'Vector similarity match'
  }));
}

/**
 * Performs keyword-based search
 */
async function performKeywordSearch(
  keywords: string[],
  namespace: string,
  topK: number,
  pineconeIndex?: any
): Promise<TypeRetrievalResult[]> {

  const keywordQuery = keywords.join(' OR ');
  const documents = await queryDocuments(keywordQuery, namespace, topK, pineconeIndex);

  return documents.map((doc, index) => ({
    document: doc,
    score: 0.8 - (index * 0.1), // Slightly lower base score than semantic
    retrievalMethod: 'keyword',
    relevanceReason: `Keyword match: ${keywords.slice(0, 3).join(', ')}`
  }));
}

/**
 * Performs contextual search based on conversation history
 */
async function performContextualSearch(
  analysis: TypeQueryAnalysis,
  conversationHistory: Array<{ role: string, content: string }>,
  namespace: string,
  topK: number,
  pineconeIndex?: any
): Promise<TypeRetrievalResult[]> {

  // Create a contextual query from recent conversation
  const recentMessages = conversationHistory.slice(-3);
  const contextQuery = recentMessages
    .map(msg => msg.content)
    .join(' ') + ' ' + analysis.expandedQuery;

  const documents = await queryDocuments(contextQuery, namespace, topK, pineconeIndex);

  return documents.map((doc, index) => ({
    document: doc,
    score: 0.7 - (index * 0.1), // Lower score as this is supplementary
    retrievalMethod: 'contextual',
    relevanceReason: 'Contextual relevance based on conversation history'
  }));
}

/**
 * Removes duplicate documents based on content similarity
 */
function removeDuplicateDocuments(results: TypeRetrievalResult[]): TypeRetrievalResult[] {
  const seen = new Set<string>();
  const unique: TypeRetrievalResult[] = [];

  for (const result of results) {
    // Use first 100 characters as a simple deduplication key
    const key = result.document.pageContent.substring(0, 100);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  return unique;
}

/**
 * Filters results by minimum relevance score
 */
function filterByRelevanceScore(
  results: TypeRetrievalResult[],
  minimumScore: number
): TypeRetrievalResult[] {
  return results.filter(result => result.score >= minimumScore);
}

/**
 * Reranks results based on query analysis
 */
async function rerankResults(
  results: TypeRetrievalResult[],
  analysis: TypeQueryAnalysis
): Promise<TypeRetrievalResult[]> {

  // Simple reranking based on query complexity and intent
  return results.map(result => {
    let scoreMultiplier = 1.0;

    // Boost scores for complex queries if document is longer
    if (analysis.complexity.level === 'complex' && result.document.pageContent.length > 500) {
      scoreMultiplier += 0.1;
    }

    // Boost semantic results for analytical queries
    if (analysis.intent.type === 'analytical' && result.retrievalMethod === 'semantic') {
      scoreMultiplier += 0.15;
    }

    // Boost keyword results for factual queries
    if (analysis.intent.type === 'factual' && result.retrievalMethod === 'keyword') {
      scoreMultiplier += 0.1;
    }

    return {
      ...result,
      score: Math.min(result.score * scoreMultiplier, 1.0)
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Applies diversity filtering to avoid too similar results
 */
function applyDiversityFiltering(
  results: TypeRetrievalResult[],
  diversityThreshold: number
): TypeRetrievalResult[] {

  if (results.length <= 1) return results;

  const diverse: TypeRetrievalResult[] = [results[0]]; // Always include the top result

  for (let i = 1; i < results.length; i++) {
    const candidate = results[i];
    let shouldInclude = true;

    // Check similarity with already selected results
    for (const selected of diverse) {
      const similarity = calculateContentSimilarity(
        candidate.document.pageContent,
        selected.document.pageContent
      );

      if (similarity > diversityThreshold) {
        shouldInclude = false;
        break;
      }
    }

    if (shouldInclude) {
      diverse.push(candidate);
    }
  }

  return diverse;
}

/**
 * Calculates simple content similarity between two texts
 */
function calculateContentSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size; // Jaccard similarity
}
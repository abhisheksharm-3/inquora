"use server";

import type { Index } from "@pinecone-database/pinecone";
import { queryDocuments } from "../processors/query-processor";
import {
  TypeQueryAnalysis,
  TypeRetrievalResult,
  TypeRetrievalConfiguration,
  TypeContextualRetrievalOptions,
} from "@/types/rag";
import { DEFAULT_RETRIEVAL_CONFIG } from "@/config/constants";
import { findIndexForNamespace, getPineconeIndex } from "../pinecone";
import { getDynamicWeights } from "./retrieval-utils";

export async function retrieveRelevantDocuments(
  analysisResult: TypeQueryAnalysis,
  namespace: string,
  options: TypeContextualRetrievalOptions = {},
  config: TypeRetrievalConfiguration = DEFAULT_RETRIEVAL_CONFIG,
): Promise<TypeRetrievalResult[]> {
  const allResults: TypeRetrievalResult[] = [];

  let pineconeIndex: Index | undefined;
  try {
    const indexInfo = await findIndexForNamespace(namespace);
    if (indexInfo) {
      pineconeIndex = indexInfo.index;
    } else {
      pineconeIndex = await getPineconeIndex();
    }
  } catch (error) {
    console.error("Failed to resolve Pinecone index:", error);
  }

  const searchPromises: Promise<TypeRetrievalResult[]>[] = [];

  searchPromises.push(
    performSemanticSearch(
      analysisResult.expandedQuery,
      namespace,
      config.strategies.find((s) => s.name === "semantic")?.topK ?? 8,
      pineconeIndex,
    ).catch((error) => {
      console.warn("Semantic search failed:", error);
      return [];
    }),
  );

  if (analysisResult.keywords.length > 0) {
    searchPromises.push(
      performKeywordSearch(
        analysisResult.keywords,
        namespace,
        config.strategies.find((s) => s.name === "keyword")?.topK ?? 5,
        pineconeIndex,
      ).catch((error) => {
        console.warn("Keyword search failed:", error);
        return [];
      }),
    );
  }

  if (options.conversationHistory && options.conversationHistory.length > 0) {
    searchPromises.push(
      performContextualSearch(
        analysisResult,
        options.conversationHistory,
        namespace,
        config.strategies.find((s) => s.name === "contextual")?.topK ?? 3,
        pineconeIndex,
      ).catch((error) => {
        console.warn("Contextual search failed:", error);
        return [];
      }),
    );
  }

  if (options.stepBackQuery) {
    searchPromises.push(
      performStepBackSearch(
        options.stepBackQuery,
        namespace,
        config.strategies.find((s) => s.name === "stepback")?.topK ?? 4,
        pineconeIndex,
      ).catch((error) => {
        console.warn("Step-back search failed:", error);
        return [];
      }),
    );
  }

  const results = await Promise.all(searchPromises);
  results.forEach((resultGroup) => allResults.push(...resultGroup));

  const deduplicatedResults = removeDuplicateDocuments(allResults);
  const filteredResults = filterByRelevanceScore(deduplicatedResults, config.minimumRelevanceScore);

  const finalResults = config.rerankingEnabled
    ? await rerankResults(filteredResults, analysisResult, config)
    : filteredResults;

  const diverseResults = applyMmrDiversity(finalResults, config.diversityThreshold);
  return diverseResults.slice(0, config.maxResults);
}

/**
 * Normalizes Pinecone similarity scores to a 0-1 range.
 * Pinecone cosine similarity already returns 0-1 (higher = more similar).
 * This function clamps and ensures consistency.
 */
function normalizeScore(rawScore: number): number {
  return Math.max(0, Math.min(1, rawScore));
}

/** Builds a keyword-focused query so the embedding emphasizes those terms. */
function buildKeywordQuery(keywords: string[]): string {
  const top = keywords.slice(0, 6);
  const phrase = top.join(" ");
  return `Keywords: ${phrase}. ${phrase}`;
}

async function performSemanticSearch(
  query: string,
  namespace: string,
  topK: number,
  pineconeIndex?: Index,
): Promise<TypeRetrievalResult[]> {
  const results = await queryDocuments(query, namespace, topK, pineconeIndex);
  return results.map(([doc, score]) => ({
    document: doc,
    score: normalizeScore(score),
    retrievalMethod: "semantic",
    relevanceReason: "Vector similarity match",
  }));
}

async function performKeywordSearch(
  keywords: string[],
  namespace: string,
  topK: number,
  pineconeIndex?: Index,
): Promise<TypeRetrievalResult[]> {
  const keywordQuery = buildKeywordQuery(keywords);
  const results = await queryDocuments(keywordQuery, namespace, topK, pineconeIndex);
  return results.map(([doc, score]) => ({
    document: doc,
    score: normalizeScore(score),
    retrievalMethod: "keyword",
    relevanceReason: `Keyword match: ${keywords.slice(0, 3).join(", ")}`,
  }));
}

async function performContextualSearch(
  analysis: TypeQueryAnalysis,
  conversationHistory: Array<{ role: string; content: string }>,
  namespace: string,
  topK: number,
  pineconeIndex?: Index,
): Promise<TypeRetrievalResult[]> {
  const recentMessages = conversationHistory.slice(-3);
  const contextQuery =
    recentMessages.map((msg) => msg.content).join(" ") + " " + analysis.expandedQuery;
  const results = await queryDocuments(contextQuery, namespace, topK, pineconeIndex);
  return results.map(([doc, score]) => ({
    document: doc,
    score: normalizeScore(score),
    retrievalMethod: "contextual",
    relevanceReason: "Contextual relevance based on conversation history",
  }));
}

async function performStepBackSearch(
  stepBackQuery: string,
  namespace: string,
  topK: number,
  pineconeIndex?: Index,
): Promise<TypeRetrievalResult[]> {
  const results = await queryDocuments(stepBackQuery, namespace, topK, pineconeIndex);
  return results.map(([doc, score]) => ({
    document: doc,
    score: normalizeScore(score),
    retrievalMethod: "stepback",
    relevanceReason: `Step-back conceptual match: "${stepBackQuery.substring(0, 60)}..."`,
  }));
}

/**
 * Removes duplicate documents based on content similarity.
 * Uses a robust normalized content signature to detect exact or near-exact duplicates.
 */
function removeDuplicateDocuments(results: TypeRetrievalResult[]): TypeRetrievalResult[] {
  const seenSignatures = new Set<string>();
  const unique: TypeRetrievalResult[] = [];

  for (const result of results) {
    // Create a robust signature: normalize whitespace, lowercase, and grab a substantial prefix
    const normalized = result.document.pageContent.toLowerCase().replace(/\s+/g, " ").trim();

    // Use first 200 chars of normalized content as signature
    const signature = normalized.substring(0, 200);

    if (signature.length > 50 && !seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      unique.push(result);
    } else if (
      signature.length <= 50 &&
      !unique.some((u) => u.document.pageContent === result.document.pageContent)
    ) {
      // Fallback for very short documents
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
  minimumScore: number,
): TypeRetrievalResult[] {
  return results.filter((result) => result.score >= minimumScore);
}

/**
 * Reranks results using strategy weights and query-aware boosting
 */
async function rerankResults(
  results: TypeRetrievalResult[],
  analysis: TypeQueryAnalysis,
  config: TypeRetrievalConfiguration,
): Promise<TypeRetrievalResult[]> {
  // Build a weight lookup from config strategies or dynamic defaults
  const dynamicWeights = getDynamicWeights(analysis.intent.type);
  const strategyWeights: Record<string, number> = {};

  for (const strategy of config.strategies) {
    // Priority: hardcoded strategy weight > dynamic intent-based weight > default
    strategyWeights[strategy.name] = strategy.weight || dynamicWeights[strategy.name] || 0.5;
  }

  return results
    .map((result) => {
      // Apply strategy weight — this is the core weighted fusion
      const strategyWeight = strategyWeights[result.retrievalMethod] ?? 0.5;
      let weightedScore = result.score * strategyWeight;

      // Intent-aware boosting (small adjustments on top of weighted score)
      if (analysis.complexity.level === "complex" && result.document.pageContent.length > 500) {
        weightedScore *= 1.05;
      }

      if (analysis.intent.type === "analytical" && result.retrievalMethod === "semantic") {
        weightedScore *= 1.1;
      }

      if (analysis.intent.type === "factual" && result.retrievalMethod === "keyword") {
        weightedScore *= 1.1;
      }

      return {
        ...result,
        score: Math.min(weightedScore, 1.0),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Applies maximal marginal relevance (MMR): greedy selection that balances relevance and diversity.
 * @param lambda - Balance between score (1-lambda) and diversity (lambda). Use diversityThreshold as lambda.
 */
function applyMmrDiversity(results: TypeRetrievalResult[], lambda: number): TypeRetrievalResult[] {
  if (results.length <= 1) return results;

  const selected: TypeRetrievalResult[] = [results[0]];
  const remaining = results.slice(1);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let maxSim = 0;
      for (const s of selected) {
        const sim = calculateContentSimilarity(
          candidate.document.pageContent,
          s.document.pageContent,
        );
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = (1 - lambda) * candidate.score - lambda * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Calculates simple content similarity between two texts
 */
function calculateContentSimilarity(text1: string, text2: string): number {
  const stopWords = new Set([
    "the",
    "is",
    "at",
    "which",
    "on",
    "and",
    "a",
    "an",
    "to",
    "in",
    "for",
    "with",
    "it",
    "that",
    "this",
    "of",
    "by",
    "from",
    "as",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
  ]);

  const getWords = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w)),
    );

  const words1 = getWords(text1);
  const words2 = getWords(text2);

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

"use server";

import { TypeConversationTurn, TypeQueryAnalysis } from "@/types/rag";

/**
 * Prepares conversation context for RAG processing
 */
export async function prepareConversationContext(
  currentQuery: string,
  conversationHistory: TypeConversationTurn[],
  currentAnalysis: TypeQueryAnalysis,
): Promise<{
  optimizedHistory: TypeConversationTurn[];
  contextSummary: string;
  relevantEntities: string[];
  continuityPrompt: string;
}> {
  if (conversationHistory.length === 0) {
    return {
      optimizedHistory: [],
      contextSummary: "New conversation started",
      relevantEntities: currentAnalysis.entities,
      continuityPrompt: "",
    };
  }

  // Optimize conversation history
  const optimizedHistory = optimizeConversationHistory(conversationHistory);

  // Create context summary
  const contextSummary = await createContextSummary(optimizedHistory, currentQuery);

  // Extract relevant entities
  const relevantEntities = extractRelevantEntities(optimizedHistory, currentAnalysis);

  // Generate continuity prompt
  const continuityPrompt = generateContinuityPrompt(optimizedHistory, currentAnalysis);

  return {
    optimizedHistory,
    contextSummary,
    relevantEntities,
    continuityPrompt,
  };
}

/**
 * Analyzes conversation for understanding and continuity
 */
export async function analyzeConversation(conversationHistory: TypeConversationTurn[]): Promise<{
  conversationType: string;
  primaryTopics: string[];
  userSatisfaction: number;
  contextEvolution: string[];
  recommendations: string[];
}> {
  if (conversationHistory.length === 0) {
    return {
      conversationType: "new",
      primaryTopics: [],
      userSatisfaction: 0.7,
      contextEvolution: [],
      recommendations: ["Start with clear, specific questions"],
    };
  }

  const conversationType = determineConversationType(conversationHistory);
  const primaryTopics = extractPrimaryTopics(conversationHistory);
  const userSatisfaction = calculateUserSatisfaction(conversationHistory);
  const contextEvolution = trackContextEvolution(conversationHistory);
  const recommendations = generateRecommendations(conversationHistory);

  return {
    conversationType,
    primaryTopics,
    userSatisfaction,
    contextEvolution,
    recommendations,
  };
}

/**
 * Optimizes conversation history for context window efficiency
 */
function optimizeConversationHistory(
  history: TypeConversationTurn[],
  maxTurns: number = 8,
): TypeConversationTurn[] {
  if (history.length <= maxTurns) {
    return history;
  }

  // Keep the most recent turns and highest confidence turns
  const recentTurns = history.slice(-Math.floor(maxTurns * 0.7));
  const remainingSlots = maxTurns - recentTurns.length;

  if (remainingSlots > 0) {
    const olderTurns = history.slice(0, -recentTurns.length);
    const highConfidenceTurns = olderTurns
      .filter((turn) => turn.confidence > 0.8)
      .slice(-remainingSlots);

    return [...highConfidenceTurns, ...recentTurns];
  }

  return recentTurns;
}

/**
 * Creates a summary of conversation context
 */
async function createContextSummary(
  history: TypeConversationTurn[],
  currentQuery: string,
): Promise<string> {
  if (history.length === 0) {
    return "New conversation about document content";
  }

  const recentTopics = history
    .slice(-3)
    .map((turn) => extractMainTopic(turn.userQuery))
    .filter(Boolean);

  const uniqueTopics = [...new Set(recentTopics)];

  return `Conversation covering: ${uniqueTopics.join(", ")}. Current focus: ${extractMainTopic(currentQuery)}`;
}

/**
 * Extracts relevant entities from conversation history
 */
function extractRelevantEntities(
  history: TypeConversationTurn[],
  currentAnalysis: TypeQueryAnalysis,
): string[] {
  const historicalEntities = history.flatMap((turn) => turn.entities || []);
  const currentEntities = currentAnalysis.entities;

  // Combine and deduplicate entities
  const allEntities = [...new Set([...historicalEntities, ...currentEntities])];

  // Return most relevant entities (simplified logic)
  return allEntities.slice(0, 10);
}

/**
 * Generates continuity prompts based on conversation flow
 */
function generateContinuityPrompt(
  history: TypeConversationTurn[],
  currentAnalysis: TypeQueryAnalysis,
): string {
  if (history.length === 0) {
    return "";
  }

  const lastTurn = history[history.length - 1];
  const isFollowUp = isFollowUpQuestion(lastTurn.userQuery, currentAnalysis.expandedQuery);
  const topicShift = hasTopicShift(history, currentAnalysis);

  const recentTopics = history.slice(-3).map((turn) => extractMainTopic(turn.userQuery));
  const currentTopic = extractMainTopic(currentAnalysis.expandedQuery);

  if (isFollowUp) {
    return `This is a follow-up question. Previous context covered: ${recentTopics.join(", ")}. The user is now asking about: ${currentTopic}. Build on the previous discussion.`;
  }

  if (topicShift) {
    return `The user has shifted topics. Previous discussion: ${recentTopics.join(", ")}. New topic: ${currentTopic}. Acknowledge the shift and provide fresh context.`;
  }

  return `Continuing discussion about: ${currentTopic}. Related prior topics: ${recentTopics.join(", ")}.`;
}

/**
 * Determines the type of conversation
 */
function determineConversationType(history: TypeConversationTurn[]): string {
  if (history.length <= 2) return "exploratory";

  const topics = history.map((turn) => extractMainTopic(turn.userQuery));
  const uniqueTopics = new Set(topics);

  if (uniqueTopics.size === 1) return "deep-dive";
  if (uniqueTopics.size > history.length * 0.7) return "broad-exploration";

  return "focused-discussion";
}

/**
 * Extracts primary topics from conversation
 */
function extractPrimaryTopics(history: TypeConversationTurn[]): string[] {
  const topics = history.map((turn) => extractMainTopic(turn.userQuery)).filter(Boolean);

  // Count topic frequency
  const topicCounts = topics.reduce(
    (acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Return topics sorted by frequency
  return Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([topic]) => topic);
}

/**
 * Heuristic for user satisfaction from model confidence and topic continuity.
 * No explicit user feedback is collected; can be replaced when feedback signals exist.
 */
function calculateUserSatisfaction(history: TypeConversationTurn[]): number {
  if (history.length === 0) return 0.7;

  // Factor in confidence and explicit satisfaction
  const avgConfidence = history.reduce((sum, turn) => sum + turn.confidence, 0) / history.length;

  // High variance in confidence or frequent topic shifts reduce satisfaction heuristic
  const topicShifts = history.filter(
    (turn, i) => i > 0 && isFollowUpQuestion(history[i - 1].userQuery, turn.userQuery) === false,
  ).length;
  const shiftPenalty = Math.min(0.2, (topicShifts / history.length) * 0.5);

  const turnsWithSatisfaction = history.filter((turn) => turn.satisfaction !== undefined);
  if (turnsWithSatisfaction.length > 0) {
    const avgSatisfaction =
      turnsWithSatisfaction.reduce((sum, turn) => sum + (turn.satisfaction || 0), 0) /
      turnsWithSatisfaction.length;
    return Math.max(0, (avgConfidence + avgSatisfaction) / 2 - shiftPenalty);
  }

  return Math.max(0, avgConfidence - shiftPenalty);
}

/**
 * Tracks how context has evolved throughout conversation
 */
function trackContextEvolution(history: TypeConversationTurn[]): string[] {
  const topics = history.map((turn) => extractMainTopic(turn.userQuery));
  const evolution: string[] = [];

  let currentTopic = topics[0];
  evolution.push(`Started with: ${currentTopic}`);

  for (let i = 1; i < topics.length; i++) {
    if (topics[i] !== currentTopic) {
      evolution.push(`Shifted to: ${topics[i]}`);
      currentTopic = topics[i];
    }
  }

  return evolution;
}

/**
 * Generates recommendations based on conversation analysis
 */
function generateRecommendations(history: TypeConversationTurn[]): string[] {
  const recommendations: string[] = [];

  if (history.length === 0) {
    recommendations.push("Start with specific questions about the document");
    return recommendations;
  }

  const avgConfidence = history.reduce((sum, turn) => sum + turn.confidence, 0) / history.length;

  if (avgConfidence < 0.6) {
    recommendations.push("Try asking more specific questions");
    recommendations.push("Provide more context about what you're looking for");
  }

  const recentTopics = extractPrimaryTopics(history.slice(-3));
  if (recentTopics.length > 2) {
    recommendations.push("Consider focusing on one topic at a time for deeper insights");
  }

  return recommendations;
}

/**
 * Extracts main topic from a query using multi-keyword extraction.
 * Filters out common stop words and prioritizes meaningful technical/academic terms.
 */
function extractMainTopic(query: string): string {
  if (!query) return "general";

  const words = query.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "which",
    "whom",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "into",
    "through",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "can",
    "has",
    "have",
    "had",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "i",
    "me",
    "my",
    "you",
    "your",
    "we",
    "our",
    "they",
    "about",
    "between",
    "some",
    "more",
    "most",
    "other",
    "also",
    "tell",
    "explain",
    "describe",
    "please",
    "give",
    "show",
    "find",
    "please",
    "actually",
    "just",
    "highly",
    "really",
    "want",
  ]);

  // Extract meaningful content words, prioritize longer words and non-standard terms
  const contentWords = words.filter(
    (word) => word.length > 2 && !stopWords.has(word) && !/^[^a-z]+$/.test(word),
  );

  if (contentWords.length === 0) return "general";

  // Sort by length (heuristic for complexity) and take top 3
  const bestWords = contentWords.sort((a, b) => b.length - a.length).slice(0, 3);

  return bestWords.join(" ");
}

/**
 * Checks if current query is a follow-up to previous one
 */
function isFollowUpQuestion(previousQuery: string, currentQuery: string): boolean {
  const followUpIndicators = [
    "what about",
    "how about",
    "also",
    "additionally",
    "furthermore",
    "more details",
    "elaborate",
    "explain further",
    "tell me more",
  ];

  const currentLower = currentQuery.toLowerCase();
  return followUpIndicators.some((indicator) => currentLower.includes(indicator));
}

/**
 * Checks if there's been a meaningful topic shift in the conversation.
 * Uses word-overlap ratio instead of string equality to avoid false positives
 * when the same topic is phrased slightly differently.
 */
function hasTopicShift(
  history: TypeConversationTurn[],
  currentAnalysis: TypeQueryAnalysis,
): boolean {
  if (history.length === 0) return false;

  const lastTopic = extractMainTopic(history[history.length - 1].userQuery);
  const currentTopic = extractMainTopic(currentAnalysis.expandedQuery);

  // If both topics resolve to 'general', treat as no shift
  if (lastTopic === "general" && currentTopic === "general") return false;

  // Jaccard overlap on topic words
  const lastWords = new Set(lastTopic.split(" ").filter((w) => w.length > 1));
  const currentWords = new Set(currentTopic.split(" ").filter((w) => w.length > 1));

  if (lastWords.size === 0 || currentWords.size === 0) return lastTopic !== currentTopic;

  const intersection = [...lastWords].filter((w) => currentWords.has(w)).length;
  const union = new Set([...lastWords, ...currentWords]).size;
  const overlap = intersection / union;

  // Overlap > 40% = same topic area, not a shift
  return overlap <= 0.4;
}

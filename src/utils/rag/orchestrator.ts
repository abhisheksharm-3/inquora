"use server";

import {
  analyzeQuery,
  expandQuery,
  decomposeQuery,
  generateStepBackQuery,
} from "./query-analysis";
import { retrieveRelevantDocuments } from "./retrieval-engine";
import { createSystemPrompt } from "./prompt-engineering";
import {
  prepareConversationContext,
  analyzeConversation,
} from "./context-manager";
import { sendMessageToGemini } from "../gemini/client";
import {
  TypeRAGRequest,
  TypeRAGResponse,
  TypeRAGConfiguration,
  TypePromptContext,
  TypeReasoningChain,
  TypeAgentDecision,
  TypeRAGAgent,
} from "@/types/rag";
import { DEFAULT_RETRIEVAL_CONFIG } from "@/config/constants";
import { queryAnalysisCache, withCache, generateCacheKey } from "./cache";
import { executeAgenticReasoning } from "./agentic-reasoning";
import {
  getAgentCapabilities,
  selectDynamicReasoningFramework,
} from "./reasoning-utils";

/**
 * Default RAG configuration
 */
const DEFAULT_RAG_CONFIG: TypeRAGConfiguration = {
  analysis: {
    enableQueryExpansion: true,
    enableSubQuestionDecomposition: true,
    enableStepBackPrompting: true,
    entityExtractionEnabled: true,
    conceptExtractionEnabled: true,
    confidenceThreshold: Number(process.env.RAG_CONFIDENCE_THRESHOLD) || 0.6,
  },
  retrieval: DEFAULT_RETRIEVAL_CONFIG,
  prompting: {
    adaptiveInstructions: true,
    contextAwarePrompts: true,
    reasoningFrameworks: true,
    contentSourceAwareness: true,
  },
  context: {
    maxHistoryTurns: Number(process.env.RAG_MAX_HISTORY) || 8,
    contextWindowSize: Number(process.env.RAG_CONTEXT_WINDOW) || 4000,
    entityTrackingEnabled: true,
    conceptTrackingEnabled: true,
    crossReferenceTracking: true,
  },
  agent: {
    enableAgenticReasoning: true,
    defaultReasoningFramework: "chain_of_thought",
    agentSpecialization: "generalist",
    confidenceThreshold: Number(process.env.RAG_AGENT_CONFIDENCE) || 0.7,
    enableSelfReflection: true,
  },
};

/**
 * Main RAG processing function that orchestrates all components
 * Optimized with parallelization and caching for improved performance
 */
export async function processRAGRequest(
  request: TypeRAGRequest,
  config: TypeRAGConfiguration = DEFAULT_RAG_CONFIG,
): Promise<TypeRAGResponse> {
  const startTime = Date.now();
  const cacheKey = generateCacheKey(request.query, request.namespace);

  try {
    const cachedAnalysis = await withCache(queryAnalysisCache, cacheKey, () =>
      analyzeQuery(request.query, config.analysis),
    );
    const analysis = { ...cachedAnalysis };

    const enableAgentic =
      request.enableAgenticReasoning !== undefined
        ? request.enableAgenticReasoning
        : config.agent.enableAgenticReasoning;

    const [
      expandedQueryResult,
      subQuestions,
      stepBackQuery,
      conversationContext,
    ] = await Promise.all([
      config.analysis.enableQueryExpansion &&
      analysis.confidenceScore >= config.analysis.confidenceThreshold
        ? expandQuery(request.query, analysis)
        : Promise.resolve(undefined),
      config.analysis.enableSubQuestionDecomposition
        ? decomposeQuery(request.query, analysis)
        : Promise.resolve([request.query]),
      config.analysis.enableStepBackPrompting
        ? generateStepBackQuery(request.query, analysis)
        : Promise.resolve(null),
      prepareConversationContext(
        request.query,
        request.conversationHistory || [],
        analysis,
      ),
    ]);

    if (expandedQueryResult) {
      analysis.expandedQuery = expandedQueryResult;
    }
    if (subQuestions.length > 1) {
      analysis.subQuestions = subQuestions;
    }
    if (stepBackQuery) {
      analysis.stepBackQuery = stepBackQuery;
    }

    // PHASE 2: Retrieval — run main query + sub-question retrieval in parallel
    const retrievalOptions = {
      conversationHistory: request.conversationHistory?.map((turn) => ({
        role: turn.userQuery ? "user" : "assistant",
        content: turn.userQuery || turn.aiResponse,
      })),
      documentMetadata: {
        type: request.documentContext?.type || "general",
        domain: request.documentContext?.domain,
      },
      userPreferences: {
        verbosity:
          request.userContext?.preferences?.response_style || "detailed",
        technical_level: (request.userContext?.expertise_level === "beginner"
          ? "basic"
          : request.userContext?.expertise_level === "expert"
            ? "expert"
            : "intermediate") as "basic" | "intermediate" | "expert",
      },
      stepBackQuery: stepBackQuery ?? undefined,
    };

    // Main retrieval pass (includes step-back search via options)
    const mainRetrievalPromise = retrieveRelevantDocuments(
      analysis,
      request.namespace,
      retrievalOptions,
      config.retrieval,
    );

    // Sub-question retrieval passes (only when decomposed into multiple sub-questions)
    const subQuestionRetrievalPromises =
      subQuestions.length > 1
        ? subQuestions.map((subQ) =>
            retrieveRelevantDocuments(
              { ...analysis, expandedQuery: subQ },
              request.namespace,
              { ...retrievalOptions, stepBackQuery: undefined }, // No step-back for sub-questions
              { ...config.retrieval, maxResults: 3 }, // Fewer results per sub-question
            ).catch((error) => {
              console.warn(
                `Sub-question retrieval failed for "${subQ}":`,
                error,
              );
              return [];
            }),
          )
        : [];

    const [mainResults, ...subQuestionResults] = await Promise.all([
      mainRetrievalPromise,
      ...subQuestionRetrievalPromises,
    ]);

    // Merge and deduplicate all retrieval results
    const allResults = [...mainResults];
    for (const subResults of subQuestionResults) {
      for (const result of subResults) {
        // Skip duplicates (by first 100 chars of content)
        const isDuplicate = allResults.some(
          (existing) =>
            existing.document.pageContent.substring(0, 100) ===
            result.document.pageContent.substring(0, 100),
        );
        if (!isDuplicate) {
          allResults.push(result);
        }
      }
    }

    const retrievedSources = allResults;

    const promptContext: TypePromptContext = {
      query: request.query,
      analysis,
      retrievedContent: retrievedSources,
      conversationContext: {
        relevantHistory: conversationContext.optimizedHistory,
        contextSummary: conversationContext.contextSummary,
        continuityType: determineContinuityType(
          conversationContext.optimizedHistory,
        ),
      },
      userContext: request.userContext,
      documentContext: request.documentContext,
    };

    // Dynamically select reasoning framework based on query analysis
    const selectedFramework = selectDynamicReasoningFramework(analysis);

    // PARALLELIZATION: Create system prompt and prepare agent in parallel
    const specializationToUse =
      analysis.suggestedSpecialization || config.agent.agentSpecialization;

    const agentConfig: TypeRAGAgent | null = enableAgentic
      ? {
          id: "rag-agent-" + Date.now(),
          capabilities: getAgentCapabilities(specializationToUse),
          specialization: specializationToUse,
          confidenceThreshold: config.agent.confidenceThreshold,
          reasoningFramework: selectedFramework,
        }
      : null;

    const [systemPrompt, agenticResponse] = (await Promise.all([
      createSystemPrompt(promptContext),
      agentConfig
        ? executeAgenticReasoning(
            request.query,
            retrievedSources
              .map((source) => source.document.pageContent)
              .join("\n\n"),
            agentConfig,
            selectedFramework,
          )
        : Promise.resolve(null),
    ])) as [
      string,
      {
        decisions: TypeAgentDecision[];
        reasoningChain: TypeReasoningChain;
        finalResponse: string;
      } | null,
    ];

    // Build final system prompt — inject agentic reasoning chain as additional context
    // rather than bypassing sendMessageToGemini (which carries source-adaptive prompting).
    const finalSystemPrompt = agenticResponse
      ? `${systemPrompt}\n\n**AGENTIC PRE-ANALYSIS (use as reasoning scaffold):**\n${agenticResponse.finalResponse}`
      : systemPrompt;

    const response = await sendMessageToGemini(
      [{ role: "user", content: request.query }],
      finalSystemPrompt,
      undefined,
      {
        currentDateTime: new Date().toISOString(),
        userName: request.userContext?.name,
      },
    );

    const processingTime = Date.now() - startTime;
    const contextWindowUsage = calculateContextWindowUsage(
      systemPrompt,
      request.query,
      config.context.contextWindowSize,
    );

    return {
      response,
      analysis,
      retrievedSources,
      contextInfo: {
        relevantHistory: conversationContext.optimizedHistory,
        contextSummary: conversationContext.contextSummary,
        continuityType: determineContinuityType(
          conversationContext.optimizedHistory,
        ),
      },
      confidence: calculateOverallConfidence(analysis, retrievedSources),
      processingMetadata: {
        queryComplexity: analysis.complexity.level,
        retrievalStrategy: getUsedRetrievalStrategies(retrievedSources),
        promptingApproach: getPromptingApproach(analysis),
        reasoningFramework: agenticResponse ? selectedFramework : undefined,
        agentCapabilities: agentConfig?.capabilities.map((c) => c.name),
        contextWindowUsage,
        processingTime,
        contentSourceAwareness: "auto-detected",
      },
    };
  } catch (error) {
    console.error("RAG processing failed:", error);

    // Return fallback response
    return createFallbackResponse(
      request,
      error as Error,
      Date.now() - startTime,
    );
  }
}

/**
 * Analyzes conversation patterns and provides insights
 */
export async function analyzeRAGConversation(request: TypeRAGRequest): Promise<{
  conversationInsights: Awaited<ReturnType<typeof analyzeConversation>>;
  performanceMetrics: {
    averageResponseTime: number;
    averageConfidence: number;
    topicDiversity: number;
    userEngagement: number;
  };
  recommendations: string[];
}> {
  const conversationInsights = await analyzeConversation(
    request.conversationHistory || [],
  );

  const performanceMetrics = calculatePerformanceMetrics(
    request.conversationHistory || [],
    0, // We don't have a single processing time for analytics requests
  );

  const recommendations = generateSystemRecommendations(
    conversationInsights,
    performanceMetrics,
  );

  return {
    conversationInsights,
    performanceMetrics,
    recommendations,
  };
}

/**
 * Determines the type of conversational continuity using topic word-overlap.
 * Compares the most recent turns to see if the discussion is deepening or shifting.
 */
function determineContinuityType(
  history: Array<{ userQuery: string; aiResponse: string }>,
): string {
  if (history.length === 0) return "new";
  if (history.length === 1) return "initial";

  // Check topic overlap between the last two turns
  const stopWords = new Set([
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "which",
    "is",
    "are",
    "was",
    "were",
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
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "can",
    "has",
    "have",
    "had",
    "this",
    "that",
    "it",
    "me",
    "my",
    "you",
    "your",
    "tell",
    "about",
    "explain",
    "please",
    "give",
    "show",
    "find",
    "some",
    "more",
  ]);

  const extractWords = (text: string): Set<string> => {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    return new Set(words);
  };

  // Compare last two turns for topic continuity
  const lastQuery = history[history.length - 1].userQuery;
  const prevQuery = history[history.length - 2].userQuery;
  const lastWords = extractWords(lastQuery);
  const prevWords = extractWords(prevQuery);

  const intersection = [...lastWords].filter((w) => prevWords.has(w)).length;
  const union = new Set([...lastWords, ...prevWords]).size;
  const overlap = union > 0 ? intersection / union : 0;

  if (overlap > 0.4) {
    // High word overlap → actively deepening the same topic
    return history.length > 4 ? "deep" : "developing";
  }

  // Low overlap → user shifted to a new topic
  return "shifted";
}

/**
 * Calculates context window usage percentage
 */
function calculateContextWindowUsage(
  systemPrompt: string,
  userQuery: string,
  maxTokens: number = 4000,
): number {
  // More sophisticated token estimation: words * 1.3
  const words = (systemPrompt + userQuery).trim().split(/\s+/).length;
  const estimatedTokens = Math.ceil(words * 1.3);

  return Math.min((estimatedTokens / maxTokens) * 100, 100);
}

/**
 * Calculates overall confidence based on analysis and retrieval
 */
function calculateOverallConfidence(
  analysis: { confidenceScore: number },
  retrievedSources: Array<{ score: number }>,
): number {
  const analysisConfidence = analysis.confidenceScore;
  const retrievalConfidence =
    retrievedSources.length > 0
      ? retrievedSources.reduce((sum, source) => sum + source.score, 0) /
        retrievedSources.length
      : 0.5;

  return (analysisConfidence + retrievalConfidence) / 2;
}

/**
 * Gets the retrieval strategies that were used
 */
function getUsedRetrievalStrategies(
  retrievedSources: Array<{ retrievalMethod: string }>,
): string {
  const strategies = new Set(
    retrievedSources.map((source) => source.retrievalMethod),
  );
  return Array.from(strategies).join(", ");
}

/**
 * Determines the prompting approach based on analysis
 */
function getPromptingApproach(analysis: {
  intent: { type: string };
  complexity: { level: string };
}): string {
  return `${analysis.intent.type}-focused, ${analysis.complexity.level}-complexity`;
}

/**
 * Calculates performance metrics for conversation history
 */
function calculatePerformanceMetrics(
  history: Array<{
    confidence: number;
    userQuery?: string;
    satisfaction?: number;
    processingMetadata?: { processingTime: number };
  }>,
  currentProcessingTime?: number,
): {
  averageResponseTime: number;
  averageConfidence: number;
  topicDiversity: number;
  userEngagement: number;
} {
  if (
    history.length === 0 &&
    (currentProcessingTime === undefined || currentProcessingTime === 0)
  ) {
    return {
      averageResponseTime: 0,
      averageConfidence: 0,
      topicDiversity: 0,
      userEngagement: 0,
    };
  }

  const averageConfidence =
    history.length > 0
      ? history.reduce((sum, turn) => sum + turn.confidence, 0) / history.length
      : 0.8;

  // Calculate average response time from metadata if available
  const historyWithTime = history.filter(
    (turn) => turn.processingMetadata?.processingTime !== undefined,
  );
  let totalTime = historyWithTime.reduce(
    (sum, turn) => sum + (turn.processingMetadata?.processingTime || 0),
    0,
  );
  let timeCount = historyWithTime.length;

  if (currentProcessingTime !== undefined && currentProcessingTime > 0) {
    totalTime += currentProcessingTime;
    timeCount += 1;
  }

  const averageResponseTime = timeCount > 0 ? totalTime / timeCount : 2000;

  // Calculate topic diversity from unique query themes
  const queries = history
    .filter(
      (turn): turn is typeof turn & { userQuery: string } => !!turn.userQuery,
    )
    .map((turn) => turn.userQuery);
  const uniqueTopicCount = new Set(
    queries.map((q) => q.toLowerCase().split(/\s+/).slice(0, 3).join(" ")),
  ).size;
  const topicDiversity =
    queries.length > 0 ? Math.min(uniqueTopicCount / queries.length, 1) : 0;

  // User engagement from explicit satisfaction data when available
  const turnsWithSatisfaction = history.filter(
    (turn) => turn.satisfaction !== undefined,
  );
  const userEngagement =
    turnsWithSatisfaction.length > 0
      ? turnsWithSatisfaction.reduce(
          (sum, turn) => sum + (turn.satisfaction || 0),
          0,
        ) / turnsWithSatisfaction.length
      : averageConfidence; // Fall back to confidence as proxy

  return {
    averageResponseTime,
    averageConfidence,
    topicDiversity,
    userEngagement,
  };
}

/**
 * Generates system-level recommendations
 */
function generateSystemRecommendations(
  insights: { userSatisfaction: number; conversationType: string },
  metrics: { averageConfidence: number; userEngagement: number },
): string[] {
  const recommendations: string[] = [];

  if (insights.userSatisfaction < 0.6) {
    recommendations.push("Consider improving response relevance and accuracy");
  }

  if (metrics.averageConfidence < 0.7) {
    recommendations.push("Enhance query analysis and retrieval strategies");
  }

  if (metrics.userEngagement < 0.6) {
    recommendations.push("Improve conversation flow and context understanding");
  }

  if (insights.conversationType === "broad-exploration") {
    recommendations.push(
      "Help users focus on specific topics for better results",
    );
  }

  return recommendations;
}

/**
 * Creates a fallback response when processing fails
 */
function createFallbackResponse(
  request: TypeRAGRequest,
  error: Error,
  processingTime: number,
): TypeRAGResponse {
  return {
    response:
      "I apologize, but I encountered an error while processing your request. Please try rephrasing your question or contact support if the issue persists.",
    analysis: {
      intent: {
        type: "factual",
        description: "Fallback response",
        confidence: 0.1,
      },
      complexity: {
        level: "simple",
        requiresMultipleChunks: false,
        requiresInference: false,
        requiresCrossDomainKnowledge: false,
        cognitiveLoad: 1,
      },
      expandedQuery: request.query,
      keywords: [],
      entities: [],
      concepts: [],
      confidenceScore: 0.1,
      processingTime: 0,
      agentDecisions: [],
    },
    retrievedSources: [],
    contextInfo: {
      relevantHistory: [],
      contextSummary: "Error occurred during processing",
      continuityType: "error",
    },
    confidence: 0.1,
    processingMetadata: {
      queryComplexity: "unknown",
      retrievalStrategy: "none",
      promptingApproach: "fallback",
      contextWindowUsage: 0,
      processingTime,
      contentSourceAwareness: "error-fallback",
    },
  };
}

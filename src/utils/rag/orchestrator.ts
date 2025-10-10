"use server";

import { analyzeQuery, expandQuery } from "./query-analysis";
import { retrieveRelevantDocuments } from "./retrieval-engine";
import { createSystemPrompt } from "./prompt-engineering";
import { prepareConversationContext, analyzeConversation } from "./context-manager";
import { executeAgenticReasoning } from "./agentic-reasoning";
import { sendMessageToGemini } from "../gemini/client";
import { 
  TypeRAGRequest, 
  TypeRAGResponse, 
  TypeRAGConfiguration,
  TypePromptContext,
  TypeReasoningChain,
  TypeAgentDecision,
  TypeRAGAgent
} from "@/types/TypeRag";

/**
 * Default RAG configuration
 */
const DEFAULT_RAG_CONFIG: TypeRAGConfiguration = {
  analysis: {
    enableQueryExpansion: true,
    entityExtractionEnabled: true,
    conceptExtractionEnabled: true,
    temporalAnalysisEnabled: true,
    confidenceThreshold: 0.6
  },
  retrieval: {
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
  },
  prompting: {
    adaptiveInstructions: true,
    contextAwarePrompts: true,
    reasoningFrameworks: true,
    multiModalPrompting: true,
    contentSourceAwareness: true
  },
  context: {
    maxHistoryTurns: 8,
    contextWindowSize: 4000,
    entityTrackingEnabled: true,
    conceptTrackingEnabled: true,
    crossReferenceTracking: true
  },
  agent: {
    enableAgenticReasoning: true,
    defaultReasoningFramework: 'chain_of_thought',
    agentSpecialization: 'generalist',
    confidenceThreshold: 0.7,
    enableSelfReflection: true
  }
};

/**
 * Main RAG processing function that orchestrates all components
 */
export async function processRAGRequest(
  request: TypeRAGRequest,
  config: TypeRAGConfiguration = DEFAULT_RAG_CONFIG
): Promise<TypeRAGResponse> {
  
  const startTime = Date.now();
  
  try {
    // Step 1: Analyze the query
    const analysis = await analyzeQuery(request.query);
    
    // Step 2: Expand query if needed and confidence is high enough
    if (config.analysis.enableQueryExpansion && analysis.confidenceScore >= config.analysis.confidenceThreshold) {
      analysis.expandedQuery = await expandQuery(request.query, analysis);
    }

    // Step 3: Prepare conversation context
    const conversationContext = await prepareConversationContext(
      request.query,
      request.conversationHistory || [],
      analysis
    );

    // Step 4: Retrieve relevant documents
    const retrievedSources = await retrieveRelevantDocuments(
      analysis,
      request.namespace,
      {
        conversationHistory: request.conversationHistory?.map(turn => ({
          role: turn.userQuery ? 'user' : 'assistant',
          content: turn.userQuery || turn.aiResponse
        })),
        documentMetadata: {
          type: request.documentContext?.type || 'general',
          domain: request.documentContext?.domain
        },
        userPreferences: {
          verbosity: request.userContext?.preferences?.response_style || 'detailed',
          technical_level: (request.userContext?.expertise_level === 'beginner' ? 'basic' : 
                           request.userContext?.expertise_level === 'expert' ? 'expert' : 'intermediate') as 'basic' | 'intermediate' | 'expert'
        }
      },
      config.retrieval
    );

    // Step 5: Create prompt context
    const promptContext: TypePromptContext = {
      query: request.query,
      analysis,
      retrievedContent: retrievedSources,
      conversationContext: {
        relevantHistory: conversationContext.optimizedHistory,
        contextSummary: conversationContext.contextSummary,
        continuityType: determineContinuityType(conversationContext.optimizedHistory)
      },
      userContext: request.userContext,
      documentContext: request.documentContext
    };

    // Step 6: Generate system prompt with agentic capabilities
    const systemPrompt = await createSystemPrompt(promptContext);

    // Step 7: Apply agentic reasoning if enabled
    let agenticResponse: {
      decisions: TypeAgentDecision[];
      reasoningChain: TypeReasoningChain;
      finalResponse: string;
    } | null = null;

    if (config.agent.enableAgenticReasoning) {
      // Create agent for agentic reasoning
      const agent: TypeRAGAgent = {
        id: 'rag-agent-' + Date.now(),
        capabilities: [
          { name: 'document_analysis', description: 'Analyze document content', enabled: true, priority: 1 },
          { name: 'context_synthesis', description: 'Synthesize information across sources', enabled: true, priority: 2 },
          { name: 'inference_generation', description: 'Generate reasonable inferences', enabled: true, priority: 3 }
        ],
        specialization: config.agent.agentSpecialization,
        confidenceThreshold: config.agent.confidenceThreshold,
        reasoningFramework: config.agent.defaultReasoningFramework
      };

      agenticResponse = await executeAgenticReasoning(
        request.query,
        retrievedSources.map(source => source.document.pageContent).join('\n\n'),
        agent
      );
    }

    // Step 8: Generate response using Gemini with agentic enhancement
    const response = agenticResponse?.finalResponse || await sendMessageToGemini(
      [{ role: "user", content: request.query }],
      systemPrompt,
      undefined,
      {
        currentDateTime: new Date().toISOString(),
        userName: request.userContext?.name,
        userEmail: request.userContext?.email
      }
    );

    // Step 9: Calculate processing metadata
    const processingTime = Date.now() - startTime;
    const contextWindowUsage = calculateContextWindowUsage(systemPrompt, request.query);

    return {
      response,
      analysis,
      retrievedSources,
      contextInfo: {
        relevantHistory: conversationContext.optimizedHistory,
        contextSummary: conversationContext.contextSummary,
        continuityType: determineContinuityType(conversationContext.optimizedHistory)
      },
      confidence: calculateOverallConfidence(analysis, retrievedSources),
      processingMetadata: {
        queryComplexity: analysis.complexity.level,
        retrievalStrategy: getUsedRetrievalStrategies(retrievedSources),
        promptingApproach: getPromptingApproach(analysis),
        reasoningFramework: agenticResponse ? config.agent.defaultReasoningFramework : undefined,
        agentCapabilities: agenticResponse ? ['document_analysis', 'context_synthesis', 'inference_generation'] : undefined,
        contextWindowUsage,
        processingTime,
        contentSourceAwareness: 'auto-detected'
      }
    };

  } catch (error) {
    console.error("RAG processing failed:", error);
    
    // Return fallback response
    return createFallbackResponse(request, error as Error, Date.now() - startTime);
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
    request.conversationHistory || []
  );

  const performanceMetrics = calculatePerformanceMetrics(request.conversationHistory || []);
  const recommendations = generateSystemRecommendations(conversationInsights, performanceMetrics);

  return {
    conversationInsights,
    performanceMetrics,
    recommendations
  };
}

/**
 * Determines the type of conversational continuity
 */
function determineContinuityType(history: Array<{ userQuery: string; aiResponse: string }>): string {
  
  if (history.length === 0) return "new";
  if (history.length === 1) return "initial";
  
  // Simple heuristic - could be more sophisticated
  return history.length > 3 ? "deep" : "developing";
}

/**
 * Calculates context window usage percentage
 */
function calculateContextWindowUsage(systemPrompt: string, userQuery: string): number {
  
  const totalTokens = (systemPrompt.length + userQuery.length) / 4; // Rough token estimation
  const maxTokens = 4000; // Conservative estimate for context window
  
  return Math.min((totalTokens / maxTokens) * 100, 100);
}

/**
 * Calculates overall confidence based on analysis and retrieval
 */
function calculateOverallConfidence(
  analysis: { confidenceScore: number },
  retrievedSources: Array<{ score: number }>
): number {
  
  const analysisConfidence = analysis.confidenceScore;
  const retrievalConfidence = retrievedSources.length > 0 
    ? retrievedSources.reduce((sum, source) => sum + source.score, 0) / retrievedSources.length
    : 0.5;
  
  return (analysisConfidence + retrievalConfidence) / 2;
}

/**
 * Gets the retrieval strategies that were used
 */
function getUsedRetrievalStrategies(retrievedSources: Array<{ retrievalMethod: string }>): string {
  
  const strategies = new Set(retrievedSources.map(source => source.retrievalMethod));
  return Array.from(strategies).join(", ");
}

/**
 * Determines the prompting approach based on analysis
 */
function getPromptingApproach(analysis: { intent: { type: string }; complexity: { level: string } }): string {
  
  return `${analysis.intent.type}-focused, ${analysis.complexity.level}-complexity`;
}

/**
 * Calculates performance metrics for conversation history
 */
function calculatePerformanceMetrics(history: Array<{ confidence: number }>): {
  averageResponseTime: number;
  averageConfidence: number;
  topicDiversity: number;
  userEngagement: number;
} {
  
  if (history.length === 0) {
    return {
      averageResponseTime: 0,
      averageConfidence: 0,
      topicDiversity: 0,
      userEngagement: 0
    };
  }

  const averageConfidence = history.reduce((sum, turn) => sum + turn.confidence, 0) / history.length;
  
  return {
    averageResponseTime: 2000, // Placeholder - would need actual timing data
    averageConfidence,
    topicDiversity: Math.min(history.length * 0.3, 1), // Simple heuristic
    userEngagement: averageConfidence > 0.7 ? 0.8 : 0.6
  };
}

/**
 * Generates system-level recommendations
 */
function generateSystemRecommendations(
  insights: { userSatisfaction: number; conversationType: string },
  metrics: { averageConfidence: number; userEngagement: number }
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
    recommendations.push("Help users focus on specific topics for better results");
  }

  return recommendations;
}

/**
 * Creates a fallback response when processing fails
 */
function createFallbackResponse(
  request: TypeRAGRequest,
  error: Error,
  processingTime: number
): TypeRAGResponse {
  
  return {
    response: "I apologize, but I encountered an error while processing your request. Please try rephrasing your question or contact support if the issue persists.",
    analysis: {
      intent: { type: 'factual', description: 'Fallback response', confidence: 0.1 },
      complexity: { 
        level: 'simple', 
        requiresMultipleChunks: false, 
        requiresInference: false,
        requiresCrossDomainKnowledge: false,
        cognitiveLoad: 1
      },
      expandedQuery: request.query,
      keywords: [],
      entities: [],
      concepts: [],
      confidenceScore: 0.1,
      processingTime: 0,
      agentDecisions: []
    },
    retrievedSources: [],
    contextInfo: {
      relevantHistory: [],
      contextSummary: "Error occurred during processing",
      continuityType: "error"
    },
    confidence: 0.1,
    processingMetadata: {
      queryComplexity: "unknown",
      retrievalStrategy: "none",
      promptingApproach: "fallback",
      contextWindowUsage: 0,
      processingTime,
      contentSourceAwareness: 'error-fallback'
    }
  };
}
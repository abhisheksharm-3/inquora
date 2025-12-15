"use server";

import { sendMessageToGemini } from "@/utils/gemini/client";
import {
  TypeQueryAnalysis,
  TypeQueryIntent,
  TypeQueryComplexity
} from "@/types/TypeRag";

/**
 * Analyzes user queries to understand intent, complexity, and extract relevant information
 */
export async function analyzeQuery(query: string): Promise<TypeQueryAnalysis> {
  const startTime = Date.now();

  const analysisPrompt = `
# QUERY ANALYSIS

Analyze query and return JSON only. No other text.

**QUERY:**
"${query}"

**REQUIRED OUTPUT:**
JSON object with:

{
  "intent": {
    "type": "factual|analytical|comparative|inferential|explanatory|procedural|creative",
    "description": "Brief description of what the user wants to achieve",
    "confidence": 0.0-1.0
  },
  "complexity": {
    "level": "simple|moderate|complex|multi-step",
    "requiresMultipleChunks": boolean,
    "requiresInference": boolean,
    "timeframe": "string if time-related",
    "scope": "narrow|broad|comprehensive"
  },
  "expandedQuery": "Expanded version with synonyms and related terms",
  "keywords": ["key", "terms", "extracted"],
  "entities": ["proper", "nouns", "concepts"],
  "confidenceScore": 0.0-1.0
}

Guidelines:
- factual: Simple fact retrieval
- analytical: Requires analysis/breakdown
- comparative: Comparing multiple items
- inferential: Reading between lines/conclusions
- explanatory: How/why explanations
- procedural: Step-by-step instructions
- creative: Synthesis/generation tasks

Return only the JSON object, no other text.`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: analysisPrompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() }
    );

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("No JSON found in response, possibly due to rate limiting or error message:", response);
      return createFallbackAnalysis(query, Date.now() - startTime);
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    const analysis: TypeQueryAnalysis = {
      intent: {
        type: analysisData.intent.type,
        description: analysisData.intent.description,
        confidence: analysisData.intent.confidence
      },
      complexity: {
        level: analysisData.complexity.level,
        requiresMultipleChunks: analysisData.complexity.requiresMultipleChunks,
        requiresInference: analysisData.complexity.requiresInference,
        requiresCrossDomainKnowledge: analysisData.complexity.requiresCrossDomainKnowledge || false,
        cognitiveLoad: analysisData.complexity.cognitiveLoad || 1,
        timeframe: analysisData.complexity.timeframe,
        scope: analysisData.complexity.scope
      },
      expandedQuery: analysisData.expandedQuery,
      keywords: analysisData.keywords || [],
      entities: analysisData.entities || [],
      concepts: analysisData.concepts || [],
      confidenceScore: analysisData.confidenceScore,
      processingTime: Date.now() - startTime,
      agentDecisions: []
    };

    return analysis;

  } catch (error) {
    console.error("Query analysis failed:", error);

    // Fallback analysis
    return createFallbackAnalysis(query, Date.now() - startTime);
  }
}

/**
 * Expands a query with related terms and synonyms
 */
export async function expandQuery(
  originalQuery: string,
  analysis: TypeQueryAnalysis
): Promise<string> {

  if (analysis.complexity.level === 'simple') {
    return originalQuery; // No expansion needed for simple queries
  }

  const expansionPrompt = `
Expand this query to improve search and retrieval:

Original Query: "${originalQuery}"
Intent: ${analysis.intent.type}
Complexity: ${analysis.complexity.level}

Create an expanded version that includes:
- Synonyms for key terms
- Related concepts
- Alternative phrasings
- Domain-specific terminology

Keep it focused and relevant. Return only the expanded query text.`;

  try {
    const expandedQuery = await sendMessageToGemini(
      [{ role: "user", content: expansionPrompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() }
    );

    return expandedQuery.trim();

  } catch (error) {
    console.error("Query expansion failed:", error);
    return originalQuery;
  }
}

/**
 * Creates a fallback analysis when AI analysis fails
 */
function createFallbackAnalysis(query: string, processingTime: number): TypeQueryAnalysis {
  const queryLower = query.toLowerCase();

  // Simple heuristics for intent detection
  let intentType: TypeQueryIntent['type'] = 'factual';
  let complexityLevel: TypeQueryComplexity['level'] = 'simple';

  if (queryLower.includes('how') || queryLower.includes('explain')) {
    intentType = 'explanatory';
    complexityLevel = 'moderate';
  } else if (queryLower.includes('compare') || queryLower.includes('versus') || queryLower.includes('vs')) {
    intentType = 'comparative';
    complexityLevel = 'moderate';
  } else if (queryLower.includes('analyze') || queryLower.includes('breakdown')) {
    intentType = 'analytical';
    complexityLevel = 'complex';
  } else if (queryLower.includes('why') || queryLower.includes('because')) {
    intentType = 'inferential';
    complexityLevel = 'moderate';
  }

  // Extract basic keywords
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['what', 'how', 'why', 'when', 'where', 'which'].includes(word));

  return {
    intent: {
      type: intentType,
      description: `${intentType} query about the document content`,
      confidence: 0.6
    },
    complexity: {
      level: complexityLevel,
      requiresMultipleChunks: ['complex', 'multi-step'].includes(complexityLevel),
      requiresInference: intentType === 'inferential' || intentType === 'analytical',
      requiresCrossDomainKnowledge: complexityLevel === 'complex',
      cognitiveLoad: complexityLevel === 'complex' ? 3 : complexityLevel === 'moderate' ? 2 : 1,
      scope: query.length > 100 ? 'broad' : 'narrow'
    },
    expandedQuery: query,
    keywords,
    entities: [],
    concepts: [],
    confidenceScore: 0.6,
    processingTime,
    agentDecisions: []
  };
}
"use server";

import { sendMessageToGemini } from "@/utils/gemini/client";
import { TypeQueryAnalysis, TypeQueryIntent, TypeQueryComplexity } from "@/types/rag";

/**
 * Analyzes user queries to understand intent, complexity, and extract relevant information
 */
export async function analyzeQuery(
  query: string,
  config?: {
    entityExtractionEnabled?: boolean;
    conceptExtractionEnabled?: boolean;
  },
): Promise<TypeQueryAnalysis> {
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
  ${config?.entityExtractionEnabled !== false ? '"entities": ["proper", "nouns", "concepts"],' : ""}
  ${config?.conceptExtractionEnabled !== false ? '"concepts": ["high-level", "abstract", "topics"],' : ""}
  "confidenceScore": 0.0-1.0,
  "suggestedSpecialization": "technical|academic|creative|analytical|generalist"
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
      { currentDateTime: new Date().toISOString() },
    );

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(
        "No JSON found in response, possibly due to rate limiting or error message:",
        response,
      );
      return createFallbackAnalysis(query, Date.now() - startTime);
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    const analysis: TypeQueryAnalysis = {
      intent: {
        type: analysisData.intent.type,
        description: analysisData.intent.description,
        confidence: analysisData.intent.confidence,
      },
      complexity: {
        level: analysisData.complexity.level,
        requiresMultipleChunks: analysisData.complexity.requiresMultipleChunks,
        requiresInference: analysisData.complexity.requiresInference,
        requiresCrossDomainKnowledge: analysisData.complexity.requiresCrossDomainKnowledge || false,
        cognitiveLoad: analysisData.complexity.cognitiveLoad || 1,
        timeframe: analysisData.complexity.timeframe,
        scope: analysisData.complexity.scope,
      },
      expandedQuery: analysisData.expandedQuery,
      keywords: analysisData.keywords || [],
      entities: analysisData.entities || [],
      concepts: analysisData.concepts || [],
      confidenceScore: analysisData.confidenceScore,
      processingTime: Date.now() - startTime,
      agentDecisions: [],
      suggestedSpecialization: analysisData.suggestedSpecialization || "generalist",
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
  analysis: TypeQueryAnalysis,
): Promise<string> {
  if (analysis.complexity.level === "simple") {
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
      { currentDateTime: new Date().toISOString() },
    );

    return expandedQuery.trim();
  } catch (error) {
    console.error("Query expansion failed:", error);
    return originalQuery;
  }
}

/**
 * Decomposes a complex query into focused sub-questions for multi-pass retrieval.
 * Only triggers for complex, multi-step, or comparative queries.
 */
export async function decomposeQuery(
  query: string,
  analysis: TypeQueryAnalysis,
): Promise<string[]> {
  // Only decompose complex/multi-step/comparative queries
  const shouldDecompose =
    ["complex", "multi-step"].includes(analysis.complexity.level) ||
    analysis.intent.type === "comparative";

  if (!shouldDecompose) {
    return [query]; // No decomposition needed
  }

  const decompositionPrompt = `
Decompose this complex query into 2-4 focused sub-questions for document search.

Original Query: "${query}"
Intent: ${analysis.intent.type}
Complexity: ${analysis.complexity.level}

Rules:
- Each sub-question should target a specific aspect of the original query
- Sub-questions should be self-contained and searchable independently
- Keep them concise and focused
- For comparative queries, create one sub-question per item being compared plus one for the comparison criteria

Return ONLY a JSON array of strings. No other text.
Example: ["What is X?", "What is Y?", "How do X and Y compare?"]`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: decompositionPrompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    // Parse the JSON array response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("Sub-question decomposition: no JSON array found in response");
      return [query];
    }

    const subQuestions: string[] = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(subQuestions) || subQuestions.length === 0) {
      return [query];
    }

    // Cap at 4 sub-questions to limit LLM/embedding calls
    const limitedQuestions = subQuestions.slice(0, 4);
    console.log(
      `Query decomposed into ${limitedQuestions.length} sub-questions:`,
      limitedQuestions,
    );
    return limitedQuestions;
  } catch (error) {
    console.error("Query decomposition failed:", error);
    return [query]; // Graceful fallback
  }
}

/**
 * Generates a broader "step-back" query to retrieve foundational context.
 * Steps back from the specific question to identify the underlying general concept.
 */
export async function generateStepBackQuery(
  query: string,
  analysis: TypeQueryAnalysis,
): Promise<string | null> {
  // No step-back needed for simple queries — they're already broad enough
  if (analysis.complexity.level === "simple") {
    return null;
  }

  const stepBackPrompt = `
Given this specific query, identify the broader underlying concept or topic.

Specific Query: "${query}"
Intent: ${analysis.intent.type}

Generate a single, broader search query that captures the foundational concept behind this question.
The broader query should help retrieve background/contextual information that supports answering the specific query.

Examples:
- Specific: "What was the GDP growth rate of India in Q3 2024?"
  Broader: "India economic performance and GDP trends"
- Specific: "How does the binary search algorithm handle duplicate elements?"
  Broader: "Binary search algorithm implementation and edge cases"
- Specific: "What side effects does metformin have on kidney function?"
  Broader: "Metformin pharmacology effects and organ interactions"

Return ONLY the broader query text. No other text, no quotes.`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: stepBackPrompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    const stepBackQuery = response.trim();

    // Sanity check: if the response is too long or looks like it contains explanations, skip it
    if (stepBackQuery.length > 200 || stepBackQuery.includes("\n")) {
      console.warn("Step-back query response was too long or multi-line, skipping");
      return null;
    }

    console.log(`Step-back query generated: "${stepBackQuery}" (from: "${query}")`);
    return stepBackQuery;
  } catch (error) {
    console.error("Step-back query generation failed:", error);
    return null; // Graceful fallback
  }
}

const FALLBACK_STOP_WORDS = new Set([
  "what",
  "how",
  "why",
  "when",
  "where",
  "which",
  "about",
  "please",
  "tell",
  "show",
  "give",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
]);

/** Derives scope from query structure: more distinct meaningful terms → broader. */
function inferScopeFromQuery(query: string): "narrow" | "broad" | "comprehensive" {
  const terms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FALLBACK_STOP_WORDS.has(w));
  const unique = new Set(terms);
  if (unique.size >= 10) return "comprehensive";
  if (unique.size >= 5) return "broad";
  return "narrow";
}

function createFallbackAnalysis(query: string, processingTime: number): TypeQueryAnalysis {
  const queryLower = query.toLowerCase();

  let intentType: TypeQueryIntent["type"] = "factual";
  let complexityLevel: TypeQueryComplexity["level"] = "simple";

  if (queryLower.includes("how") || queryLower.includes("explain")) {
    intentType = "explanatory";
    complexityLevel = "moderate";
  } else if (
    queryLower.includes("compare") ||
    queryLower.includes("versus") ||
    queryLower.includes("vs")
  ) {
    intentType = "comparative";
    complexityLevel = "moderate";
  } else if (queryLower.includes("analyze") || queryLower.includes("breakdown")) {
    intentType = "analytical";
    complexityLevel = "complex";
  } else if (queryLower.includes("why") || queryLower.includes("because")) {
    intentType = "inferential";
    complexityLevel = "moderate";
  }

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !FALLBACK_STOP_WORDS.has(word))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);

  let suggestedSpecialization: TypeQueryAnalysis["suggestedSpecialization"] = "generalist";
  if (
    queryLower.includes("code") ||
    queryLower.includes("function") ||
    queryLower.includes("api")
  ) {
    suggestedSpecialization = "technical";
  } else if (
    queryLower.includes("research") ||
    queryLower.includes("study") ||
    queryLower.includes("paper")
  ) {
    suggestedSpecialization = "academic";
  } else if (
    queryLower.includes("analyze") ||
    queryLower.includes("data") ||
    queryLower.includes("trend")
  ) {
    suggestedSpecialization = "analytical";
  }

  return {
    intent: {
      type: intentType,
      description: `${intentType} query about the document content`,
      confidence: 0.6,
    },
    complexity: {
      level: complexityLevel,
      requiresMultipleChunks: ["complex", "multi-step"].includes(complexityLevel),
      requiresInference: intentType === "inferential" || intentType === "analytical",
      requiresCrossDomainKnowledge: complexityLevel === "complex",
      cognitiveLoad: complexityLevel === "complex" ? 3 : complexityLevel === "moderate" ? 2 : 1,
      scope: inferScopeFromQuery(query),
    },
    expandedQuery: query,
    keywords,
    entities: [],
    concepts: [],
    confidenceScore: 0.6,
    processingTime,
    agentDecisions: [],
    suggestedSpecialization,
  };
}

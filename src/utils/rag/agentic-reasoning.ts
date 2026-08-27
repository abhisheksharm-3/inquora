"use server";

import { sendMessageToGemini } from "@/utils/gemini/client";
import {
  TypeRAGAgent,
  TypeAgentDecision,
  TypeReasoningChain,
  TypeReasoningStep,
} from "@/types/rag";
import { selectDynamicReasoningFramework, getAgentCapabilities } from "./reasoning-utils";

/**
 * Advanced Agentic Reasoning System
 */

export async function createRAGAgent(
  specialization:
    "generalist" | "technical" | "academic" | "creative" | "analytical" = "generalist",
  reasoningFramework:
    "chain_of_thought" | "tree_of_thought" | "react" | "reflexion" = "chain_of_thought",
): Promise<TypeRAGAgent> {
  const capabilities = getAgentCapabilities(specialization);

  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    capabilities,
    specialization,
    confidenceThreshold: 0.7,
    reasoningFramework,
  };
}

export async function executeAgenticReasoning(
  query: string,
  context: string,
  agent: TypeRAGAgent,
  framework: "chain_of_thought" | "tree_of_thought" | "react" | "reflexion" = "chain_of_thought",
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  const frameworkToUse = framework || agent.reasoningFramework || "chain_of_thought";

  switch (frameworkToUse) {
    case "chain_of_thought":
      return await executeChainOfThought(query, context, agent);
    case "tree_of_thought":
      return await executeTreeOfThought(query, context);
    case "react":
      return await executeReActReasoning(query, context);
    case "reflexion":
      return await executeReflexionReasoning(query, context);
    default:
      return await executeChainOfThought(query, context, agent);
  }
}

/**
 * Chain of Thought Reasoning
 */
async function executeChainOfThought(
  query: string,
  context: string,
  agent: TypeRAGAgent,
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  const prompt = `# CHAIN OF THOUGHT ANALYSIS

**CONTEXT:**
${context}

**QUERY:**
${query}

**INSTRUCTIONS:**
Analyze step-by-step. Provide direct, factual responses with clear reasoning structure. No conversational elements.

**FORMAT:**

REASONING STEPS:
Step 1 - Observation: [What key information do I observe?]
Step 2 - Analysis: [What patterns, relationships, or insights can I derive?]
Step 3 - Inference: [What conclusions can I draw? What might be implied?]
Step 4 - Synthesis: [How do I combine all information into a coherent understanding?]
Step 5 - Validation: [Does my reasoning hold up? Are there alternative interpretations?]

AGENT DECISIONS:
Decision 1: [Action and reasoning]
Decision 2: [Action and reasoning]
...

FINAL RESPONSE:
[Comprehensive answer based on reasoning]

CONFIDENCE ASSESSMENT:
Overall confidence: [0.0-1.0]
Alternative viewpoints: [List any alternative interpretations]`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: prompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    return parseChainOfThoughtResponse(response);
  } catch (error) {
    console.error("Chain of Thought reasoning failed:", error);
    return createFallbackReasoning();
  }
}

/**
 * Tree of Thought Reasoning - Explores multiple reasoning paths
 */
async function executeTreeOfThought(
  query: string,
  context: string,
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  const prompt = `# MULTI-PATH ANALYSIS

**CONTEXT:**
${context}

**QUERY:**
${query}

**INSTRUCTIONS:**
Explore 3 reasoning approaches. Select best path. Deliver direct factual response.

**FORMAT:**

PATH 1 - ANALYTICAL APPROACH:
- Key assumptions:
- Reasoning steps:
- Conclusion:
- Confidence:

PATH 2 - CREATIVE APPROACH:
- Key assumptions:
- Reasoning steps:
- Conclusion:
- Confidence:

PATH 3 - CONSERVATIVE APPROACH:
- Key assumptions:
- Reasoning steps:
- Conclusion:
- Confidence:

EVALUATION:
Best path: [1/2/3]
Why: [Reasoning for selection]
Synthesis: [Combined insights from all paths]

FINAL RESPONSE:
[Response based on best path with insights from others]`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: prompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    return parseTreeOfThoughtResponse(response);
  } catch (error) {
    console.error("Tree of Thought reasoning failed:", error);
    return createFallbackReasoning();
  }
}

/**
 * ReAct Reasoning - Reason and Act iteratively
 */
async function executeReActReasoning(
  query: string,
  context: string,
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  const prompt = `# ITERATIVE ANALYSIS (REACT)

**CONTEXT:**
${context}

**QUERY:**
${query}

**INSTRUCTIONS:**
Use Thought-Action-Observation cycles. Deliver structured, factual response.

**FORMAT:**

THOUGHT 1: [Initial analysis of the query]
ACTION 1: [What action should I take? retrieve/analyze/synthesize/clarify]
OBSERVATION 1: [What can I observe from the context?]

THOUGHT 2: [Based on observation, what's my next reasoning step?]
ACTION 2: [Next action needed]
OBSERVATION 2: [What new insights emerge?]

THOUGHT 3: [Further reasoning based on accumulated information]
ACTION 3: [Final action]
OBSERVATION 3: [Final insights]

CONCLUSION: [Final reasoning synthesis]
RESPONSE: [Complete answer to the query]`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: prompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    return parseReActResponse(response);
  } catch (error) {
    console.error("ReAct reasoning failed:", error);
    return createFallbackReasoning();
  }
}

/**
 * Reflexion Reasoning - Self-reflection and improvement
 */
async function executeReflexionReasoning(
  query: string,
  context: string,
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  const prompt = `# SELF-REFLECTIVE ANALYSIS

**CONTEXT:**
${context}

**QUERY:**
${query}

**INSTRUCTIONS:**
Generate initial response, evaluate, improve. Deliver direct, refined answer.

INITIAL RESPONSE:
[First attempt at answering]

SELF-REFLECTION:
- What assumptions did I make?
- What might I have missed?
- Are there alternative interpretations?
- How confident am I in each part of my response?
- What would make my answer better?

IDENTIFIED ISSUES:
- Issue 1: [Specific problem with initial response]
- Issue 2: [Another potential issue]

IMPROVED REASONING:
[Refined analysis addressing the issues]

FINAL RESPONSE:
[Improved answer incorporating self-reflection]

CONFIDENCE: [0.0-1.0 with justification]`;

  try {
    const response = await sendMessageToGemini(
      [{ role: "user", content: prompt }],
      undefined,
      undefined,
      { currentDateTime: new Date().toISOString() },
    );

    return parseReflexionResponse(response);
  } catch (error) {
    console.error("Reflexion reasoning failed:", error);
    return createFallbackReasoning();
  }
}

/**
 * Get agent capabilities based on specialization
 */

/**
 * Parse Chain of Thought response with resilient extraction
 */
function parseChainOfThoughtResponse(response: string): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  // Extract reasoning steps — try structured format first, fall back to section extraction
  const steps: TypeReasoningStep[] = [];
  const stepMatches = response.match(/Step \d+ - (\w+): \[(.*?)\]/g) || [];

  if (stepMatches.length > 0) {
    // Structured format matched
    stepMatches.forEach((match, index) => {
      const typeMatch = match.match(/Step \d+ - (\w+):/);
      const contentMatch = match.match(/\[(.*?)\]/);

      if (typeMatch && contentMatch) {
        steps.push({
          id: `step-${index + 1}`,
          type: typeMatch[1].toLowerCase() as
            "observation" | "inference" | "deduction" | "hypothesis" | "validation",
          content: contentMatch[1],
          evidence: [],
          confidence: 0.85,
          dependencies: index > 0 ? [`step-${index}`] : [],
        });
      }
    });
  } else {
    // Fallback: extract content between known section headers
    const sections = response.split(
      /(?=REASONING|STEP|OBSERVATION|ANALYSIS|INFERENCE|SYNTHESIS|VALIDATION)/i,
    );
    sections.forEach((section, index) => {
      const trimmed = section.trim();
      if (trimmed.length > 20) {
        // Skip tiny fragments
        const headerMatch = trimmed.match(/^(\w+[\w\s]*?)[:]\s*([\s\S]*)/);
        steps.push({
          id: `step-${index + 1}`,
          type: "inference",
          content: headerMatch
            ? headerMatch[2].trim().substring(0, 500)
            : trimmed.substring(0, 500),
          evidence: [],
          confidence: 0.7, // Lower confidence for fallback parsing
          dependencies: index > 0 ? [`step-${index}`] : [],
        });
      }
    });
  }

  // Extract decisions — try structured, then fallback
  const decisions: TypeAgentDecision[] = [];
  const decisionMatches = response.match(/Decision \d+: \[(.*?)\]/g) || [];

  if (decisionMatches.length > 0) {
    decisionMatches.forEach((match) => {
      const contentMatch = match.match(/\[(.*?)\]/);
      if (contentMatch) {
        decisions.push({
          action: "analyze",
          reasoning: contentMatch[1],
          confidence: 0.85,
          nextSteps: [],
        });
      }
    });
  } else {
    // Single fallback decision when structured parsing fails
    decisions.push({
      action: "analyze",
      reasoning: "Chain of thought reasoning applied (unstructured)",
      confidence: 0.7,
      nextSteps: [],
    });
  }

  // Extract final response — try multiple markers, fall back to full response
  let finalResponse = response;
  const finalResponsePatterns = [
    /FINAL RESPONSE:\s*([\s\S]*?)(?=CONFIDENCE ASSESSMENT:|CONFIDENCE:|$)/i,
    /RESPONSE:\s*([\s\S]*?)(?=CONFIDENCE|$)/i,
    /CONCLUSION:\s*([\s\S]*?)$/i,
  ];

  for (const pattern of finalResponsePatterns) {
    const match = response.match(pattern);
    if (match && match[1].trim().length > 20) {
      finalResponse = match[1].trim();
      break;
    }
  }

  // Extract confidence — try to parse from response, derive from parsing success otherwise
  const confidenceMatch = response.match(/(?:Overall )?[Cc]onfidence:?\s*([\d.]+)/);
  const parsedConfidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;
  const derivedConfidence = parsedConfidence ?? (steps.length > 0 ? 0.8 : 0.65);

  // Extract alternative viewpoints
  let alternativeViewpoints: string[] = [];
  const viewpointsMatch = response.match(
    /(?:Alternative viewpoints|ALTERNATIVE VIEWPOINTS)[:\s]*([\s\S]*?)(?:$)/i,
  );
  if (viewpointsMatch) {
    alternativeViewpoints = viewpointsMatch[1]
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s+/, "").trim())
      .filter((line) => line.length > 5);
  }

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: derivedConfidence,
    alternativeViewpoints,
  };

  return { decisions, reasoningChain, finalResponse };
}

/**
 * Parse Tree of Thought response
 */
function parseTreeOfThoughtResponse(response: string): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  // Extract final response
  const finalResponsePatterns = [/FINAL RESPONSE:\s*([\s\S]*?)$/i, /SYNTHESIS:\s*([\s\S]*?)$/i];
  let finalResponse = response;
  for (const pattern of finalResponsePatterns) {
    const m = response.match(pattern);
    if (m && m[1].trim().length > 20) {
      finalResponse = m[1].trim();
      break;
    }
  }

  // Extract the selected best path and its reasoning
  const bestPathMatch = response.match(
    /(?:Best path|BEST PATH)[:\s]+([\s\S]*?)(?=Why:|WHY:|\n\n|$)/i,
  );
  const whyMatch = response.match(/(?:Why|WHY)[:\s]+([\s\S]*?)(?=Synthesis:|SYNTHESIS:|\n\n|$)/i);
  const synthesisMatch = response.match(/(?:Synthesis|SYNTHESIS)[:\s]+([\s\S]*?)(?=FINAL|$)/i);

  const pathDescription = bestPathMatch ? bestPathMatch[1].trim() : "Multiple paths evaluated";
  const whyDescription = whyMatch
    ? whyMatch[1].trim().substring(0, 300)
    : "Best path selected by reasoning quality";
  const synthesisContent = synthesisMatch
    ? synthesisMatch[1].trim().substring(0, 300)
    : "Insights synthesized across paths";

  // Extract per-path confidence values if present, derive overall
  const pathConfidences = [...response.matchAll(/(?:Confidence|CONFIDENCE)[:\s]+([\d.]+)/gi)]
    .map((m) => parseFloat(m[1]))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 1);
  const overallConfidence =
    pathConfidences.length > 0
      ? pathConfidences.reduce((s, n) => s + n, 0) / pathConfidences.length
      : finalResponse !== response
        ? 0.8
        : 0.65; // derived from parse success

  const steps: TypeReasoningStep[] = [
    {
      id: "path-exploration",
      type: "hypothesis",
      content: `Explored 3 reasoning paths. Selected: ${pathDescription}`,
      evidence: ["analytical approach", "creative approach", "conservative approach"],
      confidence: overallConfidence,
      dependencies: [],
    },
    {
      id: "path-evaluation",
      type: "validation",
      content: whyDescription,
      evidence: [],
      confidence: overallConfidence,
      dependencies: ["path-exploration"],
    },
    {
      id: "synthesis",
      type: "inference",
      content: synthesisContent,
      evidence: [],
      confidence: overallConfidence,
      dependencies: ["path-evaluation"],
    },
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: "analyze",
      reasoning: whyDescription,
      confidence: overallConfidence,
      nextSteps: ["synthesize_insights"],
    },
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: overallConfidence,
    alternativeViewpoints: ["analytical approach", "creative approach", "conservative approach"],
  };

  return { decisions, reasoningChain, finalResponse };
}

/**
 * Parse ReAct response
 */
function parseReActResponse(response: string): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  // Extract final response — look for RESPONSE: or CONCLUSION: markers
  let finalResponse = response;
  const finalPatterns = [/RESPONSE:\s*([\s\S]*?)$/i, /CONCLUSION:\s*([\s\S]*?)$/i];
  for (const pattern of finalPatterns) {
    const m = response.match(pattern);
    if (m && m[1].trim().length > 20) {
      finalResponse = m[1].trim();
      break;
    }
  }

  // Extract thoughts — support both bracketed and unbracketed format
  const thoughtMatches = [...response.matchAll(/THOUGHT \d+:\s*(?:\[([^\]]+)\]|([^\n]+))/g)];
  const actionMatches = [...response.matchAll(/ACTION \d+:\s*(?:\[([^\]]+)\]|([^\n]+))/g)];
  const observationMatches = [
    ...response.matchAll(/OBSERVATION \d+:\s*(?:\[([^\]]+)\]|([^\n]+))/g),
  ];

  // Derive confidence from how much structured content was successfully extracted
  const structuredCount = thoughtMatches.length + actionMatches.length + observationMatches.length;
  const derivedConfidence =
    structuredCount >= 6
      ? 0.9
      : structuredCount >= 3
        ? 0.8
        : finalResponse !== response
          ? 0.7
          : 0.6;

  const steps: TypeReasoningStep[] = [];
  const decisions: TypeAgentDecision[] = [];

  thoughtMatches.forEach((match, index) => {
    const content = (match[1] || match[2] || "").trim();
    if (content) {
      steps.push({
        id: `thought-${index + 1}`,
        type: "inference",
        content,
        evidence: [],
        confidence: derivedConfidence,
        dependencies: index > 0 ? [`thought-${index}`] : [],
      });
    }
  });

  // Add observation steps interleaved
  observationMatches.forEach((match, index) => {
    const content = (match[1] || match[2] || "").trim();
    if (content) {
      steps.push({
        id: `observation-${index + 1}`,
        type: "observation",
        content,
        evidence: [],
        confidence: derivedConfidence,
        dependencies: [`thought-${index + 1}`],
      });
    }
  });

  actionMatches.forEach((match) => {
    const content = (match[1] || match[2] || "").trim();
    if (content) {
      decisions.push({
        action: "analyze",
        reasoning: content,
        confidence: derivedConfidence,
        nextSteps: [],
      });
    }
  });

  // Fallback decision when no structured actions found
  if (decisions.length === 0) {
    decisions.push({
      action: "analyze",
      reasoning: "ReAct reasoning applied (unstructured format)",
      confidence: derivedConfidence,
      nextSteps: [],
    });
  }

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: derivedConfidence,
    alternativeViewpoints: [],
  };

  return { decisions, reasoningChain, finalResponse };
}

/**
 * Parse Reflexion response
 */
function parseReflexionResponse(response: string): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  // Extract final response
  const finalResponseMatch = response.match(/FINAL RESPONSE:\s*([\s\S]*?)(?=CONFIDENCE:|$)/i);
  const finalResponse = finalResponseMatch ? finalResponseMatch[1].trim() : response;

  // Extract initial response
  const initialMatch = response.match(/INITIAL RESPONSE:\s*([\s\S]*?)(?=SELF-REFLECTION:|$)/i);
  const initialContent = initialMatch
    ? initialMatch[1].trim().substring(0, 400)
    : "Generated initial response";

  // Extract self-reflection insights
  const reflectionMatch = response.match(
    /SELF-REFLECTION:\s*([\s\S]*?)(?=IDENTIFIED ISSUES:|IMPROVED|$)/i,
  );
  const reflection = reflectionMatch ? reflectionMatch[1].trim().substring(0, 500) : "";

  // Extract identified issues
  const issuesMatch = response.match(
    /IDENTIFIED ISSUES:\s*([\s\S]*?)(?=IMPROVED REASONING:|FINAL|$)/i,
  );
  const issues = issuesMatch ? issuesMatch[1].trim().substring(0, 400) : "";

  // Extract improved reasoning
  const improvedMatch = response.match(/IMPROVED REASONING:\s*([\s\S]*?)(?=FINAL RESPONSE:|$)/i);
  const improved = improvedMatch
    ? improvedMatch[1].trim().substring(0, 400)
    : "Improved response based on self-reflection";

  // Extract confidence from LLM output
  const confidenceMatch = response.match(/CONFIDENCE[:\s]+([\d.]+)/i);
  const parsedConfidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;

  // Derive confidence from parse success if not explicitly stated
  const hasStructuredContent = !!(initialMatch && reflectionMatch && finalResponseMatch);
  const derivedConfidence =
    parsedConfidence ?? (hasStructuredContent ? 0.88 : finalResponse !== response ? 0.75 : 0.6);

  const steps: TypeReasoningStep[] = [
    {
      id: "initial-response",
      type: "hypothesis",
      content: initialContent,
      evidence: [],
      confidence: Math.max(derivedConfidence - 0.2, 0.4), // initial is less confident than final
      dependencies: [],
    },
    {
      id: "self-reflection",
      type: "validation",
      content: reflection || "Self-reflection applied to identify gaps and assumptions",
      evidence: issues ? [issues] : [],
      confidence: derivedConfidence - 0.05,
      dependencies: ["initial-response"],
    },
    {
      id: "improvement",
      type: "inference",
      content: improved,
      evidence: [],
      confidence: derivedConfidence,
      dependencies: ["self-reflection"],
    },
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: "analyze",
      reasoning: reflection
        ? `Self-reflection identified: ${reflection.substring(0, 200)}`
        : "Reflexion reasoning applied to improve initial response",
      confidence: derivedConfidence,
      nextSteps: ["self_validate"],
    },
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: derivedConfidence,
    alternativeViewpoints: ["initial approach", "reflected and improved approach"],
  };

  return { decisions, reasoningChain, finalResponse };
}

/**
 * Create fallback reasoning when advanced reasoning fails
 */
function createFallbackReasoning(): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  const steps: TypeReasoningStep[] = [
    {
      id: "fallback-analysis",
      type: "observation",
      content: "Applied fallback reasoning due to system limitations",
      evidence: [],
      confidence: 0.5,
      dependencies: [],
    },
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: "clarify",
      reasoning: "Using fallback approach due to advanced reasoning failure",
      confidence: 0.5,
      nextSteps: ["request_clarification"],
    },
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion:
      "I encountered some difficulties with advanced reasoning. Please rephrase your question for better assistance.",
    confidenceScore: 0.5,
    alternativeViewpoints: [],
  };

  return {
    decisions,
    reasoningChain,
    finalResponse:
      "I apologize, but I encountered some difficulties processing your request with advanced reasoning. Could you please rephrase your question or provide more context?",
  };
}

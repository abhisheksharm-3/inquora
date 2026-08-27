/**
 * Pure utility functions for reasoning framework selection and agent capabilities.
 * These are synchronous helpers that don't need to be Server Actions.
 */

/**
 * Unified logic used by both orchestrator (for execution) and prompt-engineering (for context).
 */
export function selectDynamicReasoningFramework(analysis: {
  intent: { type: string };
  complexity: { level: string; requiresInference: boolean };
}): "chain_of_thought" | "tree_of_thought" | "react" | "reflexion" {
  // Comparative queries benefit from exploring multiple reasoning paths
  if (analysis.intent.type === "comparative") {
    return "tree_of_thought";
  }

  // Procedural and analytical queries benefit from iterative reason-act cycles
  if (analysis.intent.type === "procedural" || analysis.intent.type === "analytical") {
    return "react";
  }

  // Creative and synthesis queries benefit from self-reflection
  if (analysis.intent.type === "creative" || analysis.intent.type === "synthesis") {
    return "reflexion";
  }

  // Complex queries with inference need step-by-step reasoning
  if (analysis.complexity.level === "complex" || analysis.complexity.requiresInference) {
    return "chain_of_thought";
  }

  // Multi-step queries benefit from tree exploration
  if (analysis.complexity.level === "multi-step") {
    return "tree_of_thought";
  }

  // Default for simple/moderate factual/explanatory queries
  return "chain_of_thought";
}

/**
 * Get agent capabilities based on specialization
 */
export function getAgentCapabilities(specialization: string): Array<{
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}> {
  const baseCapabilities = [
    {
      name: "query_analysis",
      description: "Analyze and understand query intent",
      enabled: true,
      priority: 10,
    },
    {
      name: "context_retrieval",
      description: "Retrieve relevant information",
      enabled: true,
      priority: 9,
    },
    { name: "reasoning", description: "Apply logical reasoning", enabled: true, priority: 8 },
    {
      name: "synthesis",
      description: "Combine information coherently",
      enabled: true,
      priority: 7,
    },
  ];

  const specializationCapabilities = {
    technical: [
      {
        name: "technical_analysis",
        description: "Deep technical reasoning",
        enabled: true,
        priority: 9,
      },
      {
        name: "code_understanding",
        description: "Analyze code and systems",
        enabled: true,
        priority: 8,
      },
      {
        name: "system_thinking",
        description: "Understand complex systems",
        enabled: true,
        priority: 7,
      },
    ],
    academic: [
      {
        name: "critical_analysis",
        description: "Academic-level critical thinking",
        enabled: true,
        priority: 9,
      },
      {
        name: "research_methodology",
        description: "Apply research principles",
        enabled: true,
        priority: 8,
      },
      {
        name: "citation_analysis",
        description: "Understand and use citations",
        enabled: true,
        priority: 6,
      },
    ],
    creative: [
      {
        name: "creative_synthesis",
        description: "Generate creative connections",
        enabled: true,
        priority: 9,
      },
      {
        name: "analogical_reasoning",
        description: "Use analogies and metaphors",
        enabled: true,
        priority: 8,
      },
      {
        name: "divergent_thinking",
        description: "Explore multiple perspectives",
        enabled: true,
        priority: 7,
      },
    ],
    analytical: [
      {
        name: "data_analysis",
        description: "Analyze patterns and trends",
        enabled: true,
        priority: 9,
      },
      {
        name: "statistical_reasoning",
        description: "Apply statistical thinking",
        enabled: true,
        priority: 8,
      },
      {
        name: "causal_inference",
        description: "Identify cause-effect relationships",
        enabled: true,
        priority: 7,
      },
    ],
    generalist: [],
  };

  return [
    ...baseCapabilities,
    ...(specializationCapabilities[specialization as keyof typeof specializationCapabilities] ||
      []),
  ];
}

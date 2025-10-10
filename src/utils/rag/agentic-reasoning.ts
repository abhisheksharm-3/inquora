"use server";

import { sendMessageToGemini } from "@/utils/gemini/client";
import { 
  TypeRAGAgent, 
  TypeAgentDecision, 
  TypeReasoningChain, 
  TypeReasoningStep
} from "@/types/TypeRag";

/**
 * Advanced Agentic Reasoning System
 */

export async function createRAGAgent(
  specialization: 'generalist' | 'technical' | 'academic' | 'creative' | 'analytical' = 'generalist'
): Promise<TypeRAGAgent> {
  
  const capabilities = getAgentCapabilities(specialization);
  
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    capabilities,
    specialization,
    confidenceThreshold: 0.7,
    reasoningFramework: 'chain_of_thought'
  };
}

export async function executeAgenticReasoning(
  query: string,
  context: string,
  agent: TypeRAGAgent,
  framework: 'chain_of_thought' | 'tree_of_thought' | 'react' | 'reflexion' = 'chain_of_thought'
): Promise<{
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
}> {
  
  switch (framework) {
    case 'chain_of_thought':
      return await executeChainOfThought(query, context, agent);
    case 'tree_of_thought':
      return await executeTreeOfThought(query, context);
    case 'react':
      return await executeReActReasoning(query, context);
    case 'reflexion':
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
  agent: TypeRAGAgent
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
      { currentDateTime: new Date().toISOString() }
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
  context: string
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
      { currentDateTime: new Date().toISOString() }
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
  context: string
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
      { currentDateTime: new Date().toISOString() }
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
  context: string
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
      { currentDateTime: new Date().toISOString() }
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
function getAgentCapabilities(specialization: string): Array<{
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}> {
  
  const baseCapabilities = [
    { name: 'query_analysis', description: 'Analyze and understand query intent', enabled: true, priority: 10 },
    { name: 'context_retrieval', description: 'Retrieve relevant information', enabled: true, priority: 9 },
    { name: 'reasoning', description: 'Apply logical reasoning', enabled: true, priority: 8 },
    { name: 'synthesis', description: 'Combine information coherently', enabled: true, priority: 7 }
  ];

  const specializationCapabilities = {
    technical: [
      { name: 'technical_analysis', description: 'Deep technical reasoning', enabled: true, priority: 9 },
      { name: 'code_understanding', description: 'Analyze code and systems', enabled: true, priority: 8 },
      { name: 'system_thinking', description: 'Understand complex systems', enabled: true, priority: 7 }
    ],
    academic: [
      { name: 'critical_analysis', description: 'Academic-level critical thinking', enabled: true, priority: 9 },
      { name: 'research_methodology', description: 'Apply research principles', enabled: true, priority: 8 },
      { name: 'citation_analysis', description: 'Understand and use citations', enabled: true, priority: 6 }
    ],
    creative: [
      { name: 'creative_synthesis', description: 'Generate creative connections', enabled: true, priority: 9 },
      { name: 'analogical_reasoning', description: 'Use analogies and metaphors', enabled: true, priority: 8 },
      { name: 'divergent_thinking', description: 'Explore multiple perspectives', enabled: true, priority: 7 }
    ],
    analytical: [
      { name: 'data_analysis', description: 'Analyze patterns and trends', enabled: true, priority: 9 },
      { name: 'statistical_reasoning', description: 'Apply statistical thinking', enabled: true, priority: 8 },
      { name: 'causal_inference', description: 'Identify cause-effect relationships', enabled: true, priority: 7 }
    ],
    generalist: []
  };

  return [...baseCapabilities, ...(specializationCapabilities[specialization as keyof typeof specializationCapabilities] || [])];
}

/**
 * Parse Chain of Thought response
 */
function parseChainOfThoughtResponse(response: string): {
  decisions: TypeAgentDecision[];
  reasoningChain: TypeReasoningChain;
  finalResponse: string;
} {
  
  // Extract reasoning steps
  const steps: TypeReasoningStep[] = [];
  const stepMatches = response.match(/Step \d+ - (\w+): \[(.*?)\]/g) || [];
  
  stepMatches.forEach((match, index) => {
    const typeMatch = match.match(/Step \d+ - (\w+):/);
    const contentMatch = match.match(/\[(.*?)\]/);
    
    if (typeMatch && contentMatch) {
      steps.push({
        id: `step-${index + 1}`,
        type: typeMatch[1].toLowerCase() as 'observation' | 'inference' | 'deduction' | 'hypothesis' | 'validation',
        content: contentMatch[1],
        evidence: [],
        confidence: 0.8,
        dependencies: index > 0 ? [`step-${index}`] : []
      });
    }
  });

  // Extract decisions
  const decisions: TypeAgentDecision[] = [];
  const decisionMatches = response.match(/Decision \d+: \[(.*?)\]/g) || [];
  
  decisionMatches.forEach((match) => {
    const contentMatch = match.match(/\[(.*?)\]/);
    if (contentMatch) {
      decisions.push({
        action: 'analyze',
        reasoning: contentMatch[1],
        confidence: 0.8,
        nextSteps: []
      });
    }
  });

  // Extract final response
  const finalResponseMatch = response.match(/FINAL RESPONSE:\s*([\s\S]*?)(?=CONFIDENCE ASSESSMENT:|$)/);
  const finalResponse = finalResponseMatch ? finalResponseMatch[1].trim() : response;

  // Extract confidence
  const confidenceMatch = response.match(/Overall confidence: ([\d.]+)/);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7;

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: confidence,
    alternativeViewpoints: []
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
  const finalResponseMatch = response.match(/FINAL RESPONSE:\s*([\s\S]*?)$/);
  const finalResponse = finalResponseMatch ? finalResponseMatch[1].trim() : response;

  // Create reasoning steps from paths
  const steps: TypeReasoningStep[] = [
    {
      id: 'path-exploration',
      type: 'hypothesis',
      content: 'Explored multiple reasoning paths',
      evidence: ['analytical', 'creative', 'conservative'],
      confidence: 0.8,
      dependencies: []
    },
    {
      id: 'path-evaluation',
      type: 'validation',
      content: 'Evaluated and selected best reasoning path',
      evidence: [],
      confidence: 0.8,
      dependencies: ['path-exploration']
    }
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: 'analyze',
      reasoning: 'Used tree of thought to explore multiple reasoning paths',
      confidence: 0.8,
      nextSteps: ['synthesize_insights']
    }
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: 0.8,
    alternativeViewpoints: ['analytical approach', 'creative approach', 'conservative approach']
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
  
  // Extract final response
  const finalResponseMatch = response.match(/RESPONSE:\s*([\s\S]*?)$/);
  const finalResponse = finalResponseMatch ? finalResponseMatch[1].trim() : response;

  // Extract thoughts and actions
  const thoughts = response.match(/THOUGHT \d+: \[(.*?)\]/g) || [];
  const actions = response.match(/ACTION \d+: \[(.*?)\]/g) || [];

  const steps: TypeReasoningStep[] = [];
  const decisions: TypeAgentDecision[] = [];

  thoughts.forEach((thought, index) => {
    const contentMatch = thought.match(/\[(.*?)\]/);
    if (contentMatch) {
      steps.push({
        id: `thought-${index + 1}`,
        type: 'inference',
        content: contentMatch[1],
        evidence: [],
        confidence: 0.8,
        dependencies: index > 0 ? [`thought-${index}`] : []
      });
    }
  });

  actions.forEach((action) => {
    const contentMatch = action.match(/\[(.*?)\]/);
    if (contentMatch) {
      decisions.push({
        action: 'analyze',
        reasoning: contentMatch[1],
        confidence: 0.8,
        nextSteps: []
      });
    }
  });

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: 0.8,
    alternativeViewpoints: []
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
  const finalResponseMatch = response.match(/FINAL RESPONSE:\s*([\s\S]*?)(?=CONFIDENCE:|$)/);
  const finalResponse = finalResponseMatch ? finalResponseMatch[1].trim() : response;

  // Extract self-reflection insights
  const reflectionMatch = response.match(/SELF-REFLECTION:\s*([\s\S]*?)(?=IDENTIFIED ISSUES:|$)/);
  const reflection = reflectionMatch ? reflectionMatch[1].trim() : '';

  const steps: TypeReasoningStep[] = [
    {
      id: 'initial-response',
      type: 'hypothesis',
      content: 'Generated initial response',
      evidence: [],
      confidence: 0.6,
      dependencies: []
    },
    {
      id: 'self-reflection',
      type: 'validation',
      content: reflection,
      evidence: [],
      confidence: 0.8,
      dependencies: ['initial-response']
    },
    {
      id: 'improvement',
      type: 'inference',
      content: 'Improved response based on reflection',
      evidence: [],
      confidence: 0.9,
      dependencies: ['self-reflection']
    }
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: 'analyze',
      reasoning: 'Used reflexion to improve initial response',
      confidence: 0.9,
      nextSteps: ['self_validate']
    }
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: finalResponse,
    confidenceScore: 0.9,
    alternativeViewpoints: ['initial approach', 'reflected approach']
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
      id: 'fallback-analysis',
      type: 'observation',
      content: 'Applied fallback reasoning due to system limitations',
      evidence: [],
      confidence: 0.5,
      dependencies: []
    }
  ];

  const decisions: TypeAgentDecision[] = [
    {
      action: 'clarify',
      reasoning: 'Using fallback approach due to advanced reasoning failure',
      confidence: 0.5,
      nextSteps: ['request_clarification']
    }
  ];

  const reasoningChain: TypeReasoningChain = {
    steps,
    finalConclusion: 'I encountered some difficulties with advanced reasoning. Please rephrase your question for better assistance.',
    confidenceScore: 0.5,
    alternativeViewpoints: []
  };

  return {
    decisions,
    reasoningChain,
    finalResponse: 'I apologize, but I encountered some difficulties processing your request with advanced reasoning. Could you please rephrase your question or provide more context?'
  };
}
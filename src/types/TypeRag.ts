import { Document } from "@langchain/core/documents";

/**
 * Content Source Types - Understanding what we're analyzing
 */
export interface TypeContentSource {
  type: 'pdf' | 'youtube' | 'website' | 'github' | 'doc' | 'sheet' | 'slides' | 'image' | 'code' | 'document';
  format: string;
  extractionMethod: string;
  confidence: number;
  qualityMetrics?: {
    readability?: string;
    completeness?: string;
    accuracy?: number;
  };
  metadata?: {
    title?: string;
    author?: string;
    duration?: string;
    url?: string;
    repository?: string;
    pageCount?: number;
    pages?: number;
    language?: string;
    quality?: 'high' | 'medium' | 'low';
    videoId?: string;
    channel?: string;
    fileSize?: string;
    domain?: string;
    scrapedAt?: string;
    branch?: string;
    filePath?: string;
  };
}

/**
 * Agentic RAG Agent Types
 */
export interface TypeRAGAgent {
  id: string;
  capabilities: TypeAgentCapability[];
  specialization: 'generalist' | 'technical' | 'academic' | 'creative' | 'analytical';
  confidenceThreshold: number;
  reasoningFramework: 'chain_of_thought' | 'tree_of_thought' | 'react' | 'reflexion';
}

export interface TypeAgentCapability {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
}

export interface TypeAgentDecision {
  action: 'retrieve' | 'analyze' | 'synthesize' | 'clarify' | 'delegate';
  reasoning: string;
  confidence: number;
  nextSteps: string[];
}

/**
 * Advanced Reasoning Types
 */
export interface TypeReasoningChain {
  steps: TypeReasoningStep[];
  finalConclusion: string;
  confidenceScore: number;
  alternativeViewpoints: string[];
}

export interface TypeReasoningStep {
  id: string;
  type: 'observation' | 'inference' | 'deduction' | 'hypothesis' | 'validation';
  content: string;
  evidence: string[];
  confidence: number;
  dependencies: string[]; // IDs of previous steps this depends on
}

/**
 * Multi-Modal Understanding Types
 */
export interface TypeMultiModalContext {
  textContent: string;
  visualElements?: TypeVisualElement[];
  structuralInfo?: TypeStructuralInfo;
  semanticMetadata?: TypeSemanticMetadata;
}

export interface TypeVisualElement {
  type: 'chart' | 'diagram' | 'image' | 'table' | 'code_block';
  description: string;
  location: string;
  relevanceScore: number;
}

export interface TypeStructuralInfo {
  sections: TypeDocumentSection[];
  hierarchy: TypeContentHierarchy;
  crossReferences: TypeCrossReference[];
}

export interface TypeDocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  pageNumber?: number;
  timestamp?: string; // for video sections
}

export interface TypeContentHierarchy {
  main_topics: string[];
  sub_topics: Record<string, string[]>;
  relationships: TypeTopicRelationship[];
}

export interface TypeTopicRelationship {
  from: string;
  to: string;
  type: 'dependent' | 'related' | 'contrasts' | 'builds_upon';
  strength: number;
}

export interface TypeCrossReference {
  source: string;
  target: string;
  type: 'citation' | 'reference' | 'example' | 'definition';
}

export interface TypeSemanticMetadata {
  concepts: TypeConcept[];
  entities: TypeEntity[];
  relationships: TypeConceptRelationship[];
  abstractionLevel: 'concrete' | 'abstract' | 'theoretical';
}

export interface TypeConcept {
  name: string;
  definition: string;
  category: string;
  importance: number;
  relatedTerms: string[];
}

export interface TypeEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'technology' | 'concept' | 'event';
  description: string;
  mentions: number;
}

export interface TypeConceptRelationship {
  concept1: string;
  concept2: string;
  relationship: 'is_a' | 'part_of' | 'causes' | 'enables' | 'requires';
  confidence: number;
}

/**
 * Enhanced Query Analysis Types
 */
export interface TypeQueryIntent {
  type: 'factual' | 'analytical' | 'comparative' | 'inferential' | 'explanatory' | 'procedural' | 'creative' | 'exploratory' | 'synthesis';
  description: string;
  confidence: number;
  subIntents?: TypeQueryIntent[];
}

export interface TypeQueryComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'multi-step' | 'research_level';
  requiresMultipleChunks: boolean;
  requiresInference: boolean;
  requiresCrossDomainKnowledge: boolean;
  timeframe?: string;
  scope?: 'narrow' | 'broad' | 'comprehensive';
  cognitiveLoad: number; // 1-10 scale
}

export interface TypeQueryAnalysis {
  intent: TypeQueryIntent;
  complexity: TypeQueryComplexity;
  expandedQuery: string;
  keywords: string[];
  entities: string[];
  concepts: string[];
  temporalAspects?: TypeTemporalAspect[];
  spatialAspects?: TypeSpatialAspect[];
  confidenceScore: number;
  processingTime: number;
  agentDecisions: TypeAgentDecision[];
  reasoningChain?: TypeReasoningChain;
}

export interface TypeTemporalAspect {
  type: 'point' | 'range' | 'sequence' | 'frequency';
  value: string;
  relevance: number;
}

export interface TypeSpatialAspect {
  type: 'location' | 'direction' | 'distance' | 'region';
  value: string;
  relevance: number;
}

/**
 * Advanced Retrieval Types
 */
export interface TypeRetrievalResult {
  document: Document;
  score: number;
  retrievalMethod: string;
  relevanceReason?: string;
  contextualRelevance?: number;
  temporalRelevance?: number;
  semanticDensity?: number;
  crossReferences?: string[];
  multiModalElements?: TypeVisualElement[];
}

export interface TypeRetrievalStrategy {
  name: string;
  weight: number;
  topK: number;
  enabled: boolean;
  parameters?: Record<string, unknown>;
}

export interface TypeRetrievalConfiguration {
  strategies: TypeRetrievalStrategy[];
  rerankingEnabled: boolean;
  diversityThreshold: number;
  minimumRelevanceScore: number;
  maxResults: number;
  multiModalEnabled: boolean;
  crossReferenceEnabled: boolean;
  temporalWeighting: boolean;
}

/**
 * Context Management Types
 */
export interface TypeConversationTurn {
  id: string;
  timestamp: string;
  userQuery: string;
  aiResponse: string;
  confidence: number;
  entities?: string[];
  concepts?: string[];
  intent?: string;
  satisfaction?: number;
  reasoning?: TypeReasoningChain;
  agentDecisions?: TypeAgentDecision[];
}

// Session Metadata
export interface TypeSessionMetadata {
  device?: string;
  browser?: string;
  location?: string;
  timezone?: string;
  screenSize?: string;
  platform?: string;
  language?: string;
  connection?: string;
}

export interface TypeUserContext {
  name?: string;
  email?: string;
  expertise_level?: 'beginner' | 'intermediate' | 'expert';
  preferences?: {
    response_style?: 'concise' | 'detailed' | 'comprehensive';
    include_sources?: boolean;
    include_reasoning?: boolean;
    reasoning_depth?: 'shallow' | 'moderate' | 'deep';
    creativity_level?: 'conservative' | 'balanced' | 'creative';
  };
  domain_knowledge?: string[];
  learning_goals?: string[];
  memories?: string[];
  sessionMetadata?: TypeSessionMetadata;
  recentConversations?: { id: string, title: string, timestamp: string }[];
}

export interface TypeDocumentContext {
  type: string;
  domain?: string;
  contentSource: TypeContentSource;
  structuralInfo?: TypeStructuralInfo;
  semanticMetadata?: TypeSemanticMetadata;
  processingQuality: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

export interface TypeContextualRetrievalOptions {
  conversationHistory?: Array<{ role: string, content: string }>;
  documentMetadata?: { type: string, domain?: string };
  userPreferences?: {
    verbosity: 'concise' | 'detailed' | 'comprehensive';
    technical_level: 'basic' | 'intermediate' | 'expert';
  };
  contentSource?: TypeContentSource;
  enableAgenticReasoning?: boolean;
  reasoningFramework?: 'chain_of_thought' | 'tree_of_thought' | 'react';
}

/**
 * Advanced Prompt Engineering Types
 */
export interface TypePromptContext {
  query: string;
  analysis: TypeQueryAnalysis;
  retrievedContent: TypeRetrievalResult[];
  conversationContext: {
    relevantHistory: TypeConversationTurn[];
    contextSummary: string;
    continuityType: string;
  };
  userContext?: TypeUserContext;
  documentContext?: TypeDocumentContext;
  ragAgent?: TypeRAGAgent;
  reasoningChain?: TypeReasoningChain;
  multiModalContext?: TypeMultiModalContext;
}

export interface TypePromptTemplate {
  name: string;
  template: string;
  variables: string[];
  applicableIntents: string[];
  complexity_levels: string[];
  reasoning_frameworks: string[];
}

export interface TypePromptStrategy {
  name: string;
  description: string;
  when_to_use: string[];
  template: TypePromptTemplate;
  examples: TypePromptExample[];
}

export interface TypePromptExample {
  query: string;
  context: string;
  expected_reasoning: string;
  expected_response: string;
}

/**
 * RAG Request/Response Types
 */
export interface TypeRAGRequest {
  query: string;
  chatId: string;
  namespace: string;
  conversationHistory?: TypeConversationTurn[];
  userContext?: TypeUserContext;
  documentContext?: TypeDocumentContext;
  agentConfig?: TypeRAGAgent;
  enableAgenticReasoning?: boolean;
  reasoningFramework?: 'chain_of_thought' | 'tree_of_thought' | 'react' | 'reflexion';
}

export interface TypeRAGResponse {
  response: string;
  analysis: TypeQueryAnalysis;
  retrievedSources: TypeRetrievalResult[];
  contextInfo: {
    relevantHistory: TypeConversationTurn[];
    contextSummary: string;
    continuityType: string;
  };
  confidence: number;
  reasoningChain?: TypeReasoningChain;
  agentDecisions?: TypeAgentDecision[];
  multiModalInsights?: TypeVisualElement[];
  crossReferences?: TypeCrossReference[];
  processingMetadata: {
    queryComplexity: string;
    retrievalStrategy: string;
    promptingApproach: string;
    reasoningFramework?: string;
    agentCapabilities?: string[];
    contextWindowUsage: number;
    processingTime: number;
    contentSourceAwareness: string;
  };
}

/**
 * Configuration Types
 */
export interface TypeRAGConfiguration {
  analysis: {
    enableQueryExpansion: boolean;
    entityExtractionEnabled: boolean;
    conceptExtractionEnabled: boolean;
    temporalAnalysisEnabled: boolean;
    confidenceThreshold: number;
  };
  retrieval: TypeRetrievalConfiguration;
  prompting: {
    adaptiveInstructions: boolean;
    contextAwarePrompts: boolean;
    reasoningFrameworks: boolean;
    multiModalPrompting: boolean;
    contentSourceAwareness: boolean;
  };
  context: {
    maxHistoryTurns: number;
    contextWindowSize: number;
    entityTrackingEnabled: boolean;
    conceptTrackingEnabled: boolean;
    crossReferenceTracking: boolean;
  };
  agent: {
    enableAgenticReasoning: boolean;
    defaultReasoningFramework: 'chain_of_thought' | 'tree_of_thought' | 'react' | 'reflexion';
    agentSpecialization: 'generalist' | 'technical' | 'academic' | 'creative' | 'analytical';
    confidenceThreshold: number;
    enableSelfReflection: boolean;
  };
}
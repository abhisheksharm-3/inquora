"use server";

import {
  TypePromptContext,
  TypeQueryAnalysis,
  TypeContentSource,
  TypeMultiModalContext,
  TypeSessionMetadata,
} from "@/types/rag";
import { selectDynamicReasoningFramework } from "./reasoning-utils";

/**
 * Creates sophisticated system prompts with content source awareness
 */
export async function createSystemPrompt(
  context: TypePromptContext,
): Promise<string> {
  const analysis = context.analysis;
  const contentSource = detectContentSource(context);
  const reasoningFramework = selectDynamicReasoningFramework(analysis);
  const reasoningStrategy = reasoningFramework
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const sourceAwareContext = buildSourceAwareContext(contentSource, context);
  const agenticInstructions = generateAgenticInstructions(reasoningStrategy);
  const multiModalContext = buildMultiModalContext(context.multiModalContext);
  const adaptiveGuidelines = generateAdaptiveGuidelines(context, contentSource);

  const documentContent = context.retrievedContent
    .map((result) => result.document.pageContent)
    .join("\n\n");

  return `# INQUORA DOCUMENT ANALYSIS SYSTEM

**SYSTEM IDENTITY:**
Document analysis system for Inquora. Analyze documents with precision and deliver direct, factual responses.

**OBJECTIVE:**
Provide accurate document analysis based strictly on source material. Deliver clear, structured information without elaboration or conversational elements.

**OPERATIONAL CONTEXT:**
${sourceAwareContext}

**CONTENT INTELLIGENCE ASSESSMENT:**
${buildAnalysisInfo(analysis)}

**ACTIVE REASONING PROTOCOL:** ${reasoningStrategy}
${agenticInstructions}

**SOURCE-ADAPTIVE ANALYSIS FRAMEWORK:**
${adaptiveGuidelines}

**MULTI-MODAL PROCESSING:**
${multiModalContext}

**TARGET DOCUMENT CORPUS:**
---
${documentContent}
---

**RESPONSE PROTOCOL:**

**CORE DIRECTIVES:**
1. **SOURCE FIDELITY:** Base responses exclusively on document content - no external knowledge
2. **ANALYTICAL METHOD:** ${reasoningStrategy} approach for ${analysis.intent.type} queries
3. **CONTENT TYPE:** ${contentSource.type} source with ${(contentSource.confidence * 100).toFixed(0)}% confidence
4. **RESPONSE STYLE:** Direct, structured information - no conversational filler
5. **EVIDENCE REQUIRED:** Every claim must reference document content
6. **BREVITY:** Eliminate unnecessary words - deliver information directly

**RESPONSE EXECUTION FRAMEWORK:**
- **ANALYTICAL DEPTH:** ${getIntentSpecificGuidelines(analysis.intent.type)}
- **REASONING STRUCTURE:** ${getComplexityStrategy(analysis.complexity.level)}
- **SOURCE ADAPTATION:** ${getSourceSpecificStrategy(contentSource.type)}

**OUTPUT STANDARDS:**
• **Structure:** Clear hierarchical structure and logical progression
• **Evidence:** Link assertions to source material with explicit confidence metrics

**RESPONSE RULES:**
• Answer based ONLY on document content
• If information missing: State "Document does not contain [specific information needed]" - nothing more
• No conversational phrases like "here's a summary," "let me explain," "I hope this helps"
• No meta-commentary about the analysis process
• Start responses with direct information, not introductions
• Use bullet points and structure for clarity
• State facts - don't describe what you're doing

**FORBIDDEN PHRASES:**
❌ "Here's a summary..."
❌ "This resume presents..."
❌ "Let me break this down..."
❌ "I'll analyze..."
❌ "Based on my analysis..."
❌ "To summarize..."
❌ Any phrase that sounds like an AI assistant talking

**REQUIRED STYLE:**
✅ Direct factual statements
✅ Structured lists and sections
✅ Clear, concise language
✅ Information-first approach`;
}

/**
 * Creates RAG system prompts with full agentic awareness
 */
export async function createAgenticRagPrompt(
  documentContent: string,
  context?: {
    currentDateTime?: string;
    userName?: string;
    chatId?: string;
    userQuery?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    documentType?: string;
    namespace?: string;
    contentSource?: TypeContentSource;
    memories?: string[];
    recentConversations?: { id: string; title: string; timestamp: string }[];
  },
): Promise<string> {
  const contentSource =
    context?.contentSource || inferContentSourceFromContext(context);
  const adaptiveStrategy = getAdaptiveStrategy(documentContent);
  const contextualPrompting = buildContextualPrompting(context);
  const userDeepContext = buildUserDeepContext(context);
  const sourceAwareInstructions =
    generateSourceAwareInstructions(contentSource);

  return `# INQUORA DOCUMENT ANALYSIS

**SYSTEM ROLE:**
Analyze documents and provide direct, factual responses. No conversational elements.

**CONTENT SOURCE INTELLIGENCE:**
- **Material Type:** ${contentSource.type.toUpperCase()} | **Format:** ${contentSource.format}
- **Extraction Protocol:** ${contentSource.extractionMethod}
- **Source Confidence:** ${(contentSource.confidence * 100).toFixed(0)}% | **Quality Index:** ${JSON.stringify(contentSource.qualityMetrics)}

**OPERATIONAL PARAMETERS:**
${contextualPrompting}

${userDeepContext}

**CONTENT CHARACTERIZATION:**
Analyzing ${getSourceDescription(contentSource)} with the following dimensional properties:
${adaptiveStrategy}

**SOURCE-ADAPTIVE PROCESSING:**
${sourceAwareInstructions}

**PRIMARY DOCUMENT CORPUS:**
---
${documentContent}
---

**ANALYSIS PARAMETERS:**

**SOURCE INFO:**
• Content type: ${contentSource.type}
• Confidence: ${(contentSource.confidence * 100).toFixed(0)}%
• Format: ${contentSource.format}

**PROCESSING:**
• Extract information from source only
• Structure data clearly
• No external knowledge
• No conversational responses

**OUTPUT RULES:**

1. **DIRECT RESPONSES ONLY**
   - Start with information, not preamble
   - No "Here's...", "Let me...", "I'll...", "This document..."
   - Just deliver the information

2. **STRUCTURE**
   - Use headings and bullets for clarity
   - Group related information
   - Keep sentences short and factual

3. **MISSING INFO**
   - State: "Document lacks [specific info]"
   - Don't elaborate or apologize
   - Move on

4. **FORBIDDEN STYLE:**
   ❌ Conversational phrases
   ❌ Meta-commentary ("based on my analysis")
   ❌ Introductory statements ("here's a summary")
   ❌ Explanations of what you're doing
   ❌ AI assistant voice

5. **REQUIRED STYLE:**
   ✅ Information-first
   ✅ Factual statements
   ✅ Clear structure
   ✅ Direct language`;
}

// Helper functions
function detectContentSource(context: TypePromptContext): TypeContentSource {
  const firstDoc = context.retrievedContent[0]?.document;
  if (!firstDoc) {
    return createDefaultContentSource();
  }

  const metadata = firstDoc.metadata;
  const content = firstDoc.pageContent;

  // YouTube detection
  if (
    metadata?.source?.includes("youtube") ||
    metadata?.url?.includes("youtube.com") ||
    content.includes("[Music]") ||
    content.includes("transcript") ||
    metadata?.type === "youtube"
  ) {
    return {
      type: "youtube",
      format: "transcript",
      extractionMethod: "YouTube API + transcript processing",
      confidence: 0.95,
      qualityMetrics: {
        readability: assessReadability(content),
        completeness: assessCompleteness(content, "youtube"),
        accuracy: 0.9,
      },
      metadata: {
        videoId: metadata?.videoId,
        title: metadata?.title,
        duration: metadata?.duration,
        channel: metadata?.channel,
      },
    };
  }

  // PDF detection
  if (
    metadata?.source?.endsWith(".pdf") ||
    metadata?.type === "pdf" ||
    content.includes("Figure") ||
    content.includes("Table") ||
    /Page \d+/.test(content)
  ) {
    return {
      type: "pdf",
      format: "extracted_text",
      extractionMethod: "PDF text extraction + OCR",
      confidence: 0.9,
      qualityMetrics: {
        readability: assessReadability(content),
        completeness: assessCompleteness(content, "pdf"),
        accuracy: 0.85,
      },
      metadata: {
        pages: metadata?.pages,
        fileSize: metadata?.fileSize,
        title: metadata?.title,
      },
    };
  }

  // Website detection
  if (
    metadata?.url &&
    (metadata.url.startsWith("http://") || metadata.url.startsWith("https://"))
  ) {
    return {
      type: "website",
      format: "scraped_content",
      extractionMethod: "Web scraping + content cleaning",
      confidence: 0.8,
      qualityMetrics: {
        readability: assessReadability(content),
        completeness: assessCompleteness(content, "website"),
        accuracy: 0.8,
      },
      metadata: {
        url: metadata.url,
        domain: new URL(metadata.url).hostname,
        scrapedAt: metadata.scrapedAt,
        title: metadata.title,
      },
    };
  }

  // Code repository detection
  if (
    metadata?.source?.includes(".git") ||
    content.includes("function") ||
    content.includes("class ") ||
    content.includes("import ") ||
    metadata?.type === "code"
  ) {
    return {
      type: "code",
      format: "source_code",
      extractionMethod: "Repository parsing + syntax analysis",
      confidence: 0.88,
      qualityMetrics: {
        readability: assessReadability(content),
        completeness: assessCompleteness(content, "code"),
        accuracy: 0.95,
      },
      metadata: {
        language: metadata?.language,
        repository: metadata?.repository,
        branch: metadata?.branch,
        filePath: metadata?.filePath,
      },
    };
  }

  return {
    type: "document",
    format: "plain_text",
    extractionMethod: "Direct text processing",
    confidence: 0.7,
    qualityMetrics: {
      readability: assessReadability(content),
      completeness: assessCompleteness(content, "document"),
      accuracy: 0.8,
    },
    metadata: metadata,
  };
}

function buildSourceAwareContext(
  contentSource: TypeContentSource,
  context: TypePromptContext,
): string {
  const userInfo = context.userContext
    ? `- User: ${context.userContext.name || "Anonymous"}`
    : "- User: Anonymous";

  const sourceInfo = `- Content Source: ${contentSource.type.toUpperCase()} (${contentSource.format})
  - Extraction Method: ${contentSource.extractionMethod}
  - Source Confidence: ${(contentSource.confidence * 100).toFixed(0)}%`;

  return `${userInfo}
  ${sourceInfo}`;
}

function generateAgenticInstructions(strategy: string): string {
  switch (strategy) {
    case "Chain of Thought":
      return `**CHAIN OF THOUGHT ANALYTICAL PROTOCOL:**
      • **Phase 1:** Systematic problem deconstruction into logical components
      • **Phase 2:** Sequential reasoning progression with explicit validation checkpoints
      • **Phase 3:** Evidence integration across reasoning chain with confidence mapping
      • **Phase 4:** Conclusion synthesis with full reasoning transparency`;

    case "Tree of Thought":
      return `**TREE OF THOUGHT ANALYTICAL PROTOCOL:**
      • **Multi-Path Exploration:** Simultaneous evaluation of alternative reasoning approaches
      • **Perspective Integration:** Cross-dimensional analysis incorporating multiple viewpoints
      • **Branch Optimization:** Dynamic selection of highest-value analytical pathways
      • **Convergence Synthesis:** Unified insights from distributed reasoning architecture`;

    case "ReAct":
      return `**REACT ANALYTICAL PROTOCOL:**
      • **Reason:** Systematic problem analysis with explicit methodology declaration
      • **Act:** Strategic information processing with targeted analytical operations
      • **Observe:** Pattern recognition and result evaluation with quality metrics
      • **Iterate:** Continuous reasoning refinement based on observational feedback`;

    case "Reflexion":
      return `**REFLEXION ANALYTICAL PROTOCOL:**
      • **Initial Analysis:** Generate a first-pass response to the query
      • **Self-Evaluation:** Critically examine assumptions, gaps, and alternative interpretations
      • **Issue Identification:** Enumerate specific weaknesses in the initial response
      • **Refinement:** Produce an improved response that addresses identified issues`;

    default:
      return `**STANDARD ANALYTICAL PROTOCOL:**
      • **Systematic Processing:** Linear analytical progression with logical coherence
      • **Evidence Integration:** Comprehensive source material synthesis
      • **Accuracy:** Verification and validation of claims
      • **Professional Delivery:** Expert-level communication standards`;
  }
}

function buildMultiModalContext(multiModal?: TypeMultiModalContext): string {
  if (!multiModal) return "No multi-modal context available";

  const visual = multiModal.visualElements
    ? `- Visual Elements: ${multiModal.visualElements.length} elements`
    : "- No visual elements detected";

  return visual;
}

function generateAdaptiveGuidelines(
  context: TypePromptContext,
  contentSource: TypeContentSource,
): string {
  switch (contentSource.type) {
    case "youtube":
      return `**YOUTUBE CONTENT ANALYSIS PROTOCOL:**
      • **Transcription Awareness:** Account for speech-to-text conversion artifacts and natural language patterns
      • **Temporal Context:** Recognize video flow, speaker emphasis, and conversational dynamics
      • **Reference Framework:** Utilize "video presenter states" and "content demonstrates" language
      • **Quality Considerations:** Factor in potential audio quality limitations and transcription gaps
      • **Content Adaptation:** Apply conversational analysis techniques for spoken content interpretation`;

    case "pdf":
      return `**PDF DOCUMENT ANALYSIS PROTOCOL:**
      • **Structural Intelligence:** Leverage formal document architecture, sections, and hierarchical organization
      • **Academic Standards:** Maintain scholarly rigor appropriate to document type and domain
      • **Visual Element Recognition:** Account for missing figures, tables, and formatting context
      • **Citation Methodology:** Reference specific document sections, pages, and structural elements
      • **Professional Tone:** Align analytical approach with document's academic or professional context`;

    case "website":
      return `**WEB CONTENT ANALYSIS PROTOCOL:**
      • **Scraping Limitations:** Acknowledge potential missing navigation, images, and interactive elements
      • **Context Reconstruction:** Infer website purpose, target audience, and content strategy
      • **Fragmentation Management:** Handle incomplete content sections and potential extraction gaps
      • **Source Attribution:** Reference web source with appropriate digital content acknowledgment
      • **Audience Alignment:** Adapt analysis depth to inferred website audience and purpose`;

    case "code":
      return `**CODE REPOSITORY ANALYSIS PROTOCOL:**
      • **Technical Precision:** Maintain programming accuracy and software engineering standards
      • **Architecture Analysis:** Evaluate code structure, patterns, and implementation quality
      • **Context Integration:** Reference specific functions, classes, and implementation details
      • **Best Practices Assessment:** Apply software engineering principles and quality standards
      • **Documentation Standards:** Generate technical explanations with appropriate developer-level detail`;

    default:
      return `**GENERAL DOCUMENT ANALYSIS PROTOCOL:**
      • **Universal Standards:** Apply comprehensive document analysis methodologies
      • **Content Adaptation:** Adjust formality and complexity to document characteristics
      • **Quality Maintenance:** Ensure analytical rigor regardless of source type
      • **Professional Delivery:** Maintain expert-level communication standards across all content types`;
  }
}

function buildAnalysisInfo(analysis: TypeQueryAnalysis): string {
  return `- Intent: ${analysis.intent.type} (${analysis.intent.description})
  - Complexity: ${analysis.complexity.level}
  - Confidence: ${(analysis.confidenceScore * 100).toFixed(0)}%`;
}

function getIntentSpecificGuidelines(intentType: string): string {
  const guidelines = {
    factual:
      "Deploy systematic fact extraction with source verification, evidence hierarchies, and confidence quantification for all assertions",
    analytical:
      "Execute multi-dimensional analysis with explicit reasoning methodologies, evidence synthesis, and transparent inferential logic",
    comparative:
      "Construct comprehensive comparison matrices with categorical analysis, weighted evaluation criteria, and strategic implications",
    inferential:
      "Maintain strict evidence-inference separation with confidence levels, logical chain validation, and uncertainty quantification",
    explanatory:
      "Build progressive understanding architectures with conceptual scaffolding, practical applications, and complexity adaptation",
    procedural:
      "Generate actionable process frameworks with prerequisite analysis, risk assessment, and implementation optimization",
    creative:
      "Synthesize innovative insights while maintaining source fidelity, evidence grounding, and analytical rigor",
  };

  return (
    guidelines[intentType as keyof typeof guidelines] || guidelines.factual
  );
}

function getComplexityStrategy(complexityLevel: string): string {
  const strategies = {
    simple:
      "Execute streamlined analysis with essential information extraction, clear categorization, and direct actionable insights",
    moderate:
      "Deploy comprehensive analytical frameworks with structured explanations, evidence integration, and professional depth",
    complex:
      "Implement multi-dimensional analysis architectures with detailed reasoning chains, cross-domain synthesis, and expert-level insights",
    "multi-step":
      "Construct systematic progression protocols with phase-based analysis, checkpoint validation, and integrated synthesis",
  };

  return (
    strategies[complexityLevel as keyof typeof strategies] ||
    strategies.moderate
  );
}

function getSourceSpecificStrategy(sourceType: string): string {
  const strategies = {
    youtube:
      "Deploy conversational content analysis with temporal flow recognition, speaker intent inference, and speech-pattern adaptation",
    pdf: "Execute formal document analysis with structural intelligence, academic rigor, and hierarchical content processing",
    website:
      "Implement web content reconstruction with context inference, audience analysis, and digital communication standards",
    code: "Apply software engineering analysis with technical precision, architectural evaluation, and development best practices",
    document:
      "Utilize comprehensive document intelligence with adaptive complexity and professional analytical standards",
  };

  return (
    strategies[sourceType as keyof typeof strategies] || strategies.document
  );
}

function createDefaultContentSource(): TypeContentSource {
  return {
    type: "document",
    format: "plain_text",
    extractionMethod: "Direct text processing",
    confidence: 0.5,
    qualityMetrics: {
      readability: "standard",
      completeness: "partial",
      accuracy: 0.7,
    },
  };
}

function inferContentSourceFromContext(
  context: { namespace?: string } | null | undefined,
): TypeContentSource {
  if (context?.namespace?.includes("youtube")) {
    return {
      type: "youtube",
      format: "transcript",
      extractionMethod: "YouTube API + transcript processing",
      confidence: 0.8,
      qualityMetrics: {
        readability: "conversational",
        completeness: "high",
        accuracy: 0.85,
      },
    };
  }
  return createDefaultContentSource();
}

function getAdaptiveStrategy(content: string): string {
  const length = content.length;
  const hasCode = /function|class|import|export/.test(content);

  let strategy = `- Content Length: ${length > 10000 ? "Large" : length > 3000 ? "Medium" : "Short"} document`;

  if (hasCode)
    strategy += "\n- Contains code elements requiring technical precision";

  return strategy;
}

function buildUserDeepContext(
  context:
    | {
        memories?: string[];
        recentConversations?: {
          id: string;
          title: string;
          timestamp: string;
        }[];
        userName?: string;
      }
    | undefined
    | null,
): string {
  if (!context) return "";

  let section = `**USER PROFILE & CONTEXT:**`;
  section += `\n    • **Identity:** ${context.userName || "Anonymous"}`;

  // Memories (Long-term)
  if (context.memories && context.memories.length > 0) {
    section += `\n    • **Long-Term Memory:**\n      ${context.memories.map((m) => `- ${m}`).join("\n      ")}`;
  }

  // Recent Conversations
  if (context.recentConversations && context.recentConversations.length > 0) {
    section += `\n    • **Recent Activity:**\n      ${context.recentConversations.map((c) => `- ${c.title}`).join("\n      ")}`;
  }

  return section === `**USER PROFILE & CONTEXT:**` ? "" : section;
}

function buildContextualPrompting(
  context:
    | {
        currentDateTime?: string;
        userName?: string;
        chatId?: string;
        userQuery?: string;
      }
    | null
    | undefined,
): string {
  if (!context) return "No additional context provided";

  return `- Time: ${context.currentDateTime || "Not specified"}
  - User: ${context.userName || "Anonymous"}
  - Session: ${context.chatId || "New session"}`;
}

function generateSourceAwareInstructions(source: TypeContentSource): string {
  const baseInstructions = `**SOURCE INTELLIGENCE PROTOCOL:**
  • **Extraction Methodology:** ${source.extractionMethod}
  • **Quality Confidence Index:** ${(source.confidence * 100).toFixed(0)}%
  • **Accuracy Parameters:** ${((source.qualityMetrics?.accuracy || 0.8) * 100).toFixed(0)}% expected precision`;

  switch (source.type) {
    case "youtube":
      return (
        baseInstructions +
        `
      • **TRANSCRIPTION PROCESSING:** Content represents spoken discourse converted to text format
      • **QUALITY CONSIDERATIONS:** Account for potential transcription errors, audio quality variations, and speech pattern artifacts
      • **REFERENCE PROTOCOL:** Utilize "video content indicates," "presenter discusses," or "material demonstrates" formulations
      • **TEMPORAL AWARENESS:** Recognize conversational flow, emphasis patterns, and spoken delivery context
      • **ANALYTICAL ADAPTATION:** Apply speech-to-text content analysis methodologies with appropriate uncertainty factors`
      );

    case "pdf":
      return (
        baseInstructions +
        `
      • **DOCUMENT ARCHITECTURE:** Content extracted from formal document structure with potential formatting artifacts
      • **VISUAL ELEMENT GAPS:** Account for missing figures, tables, charts, and graphical content not captured in text extraction
      • **FORMAL STANDARDS:** Maintain academic/professional analysis standards appropriate to document type and domain
      • **REFERENCE FRAMEWORK:** Cite specific document sections, page references, and structural elements when available
      • **PROFESSIONAL TONE:** Align analytical rigor with document's institutional or academic context and intended audience`
      );

    case "website":
      return (
        baseInstructions +
        `
      • **WEB EXTRACTION CONTEXT:** Content derived from web scraping with potential navigation and multimedia gaps
      • **CONTEXTUAL INFERENCE:** Reconstruct website purpose, target audience, and communication strategy from available content
      • **FRAGMENTATION MANAGEMENT:** Account for potential missing contextual elements, interactive features, and linked content
      • **DIGITAL STANDARDS:** Apply web content analysis protocols with appropriate uncertainty for extraction limitations
      • **AUDIENCE ADAPTATION:** Infer and adapt to intended web audience sophistication and domain expertise levels`
      );

    default:
      return (
        baseInstructions +
        `
      • **STANDARD PROCESSING:** Content processed through conventional document analysis protocols
      • **QUALITY ASSURANCE:** Maintain analytical rigor with evidence-based reasoning and source fidelity
      • **PROFESSIONAL STANDARDS:** Deploy expert-level analysis appropriate to content domain and complexity
      • **ADAPTIVE METHODOLOGY:** Adjust analytical depth and approach based on content characteristics and user requirements`
      );
  }
}

function getSourceDescription(source: TypeContentSource): string {
  const descriptions = {
    youtube: "a YouTube video transcript",
    pdf: "a PDF document",
    website: "web content",
    code: "a code repository",
    document: "a text document",
  };

  return descriptions[source.type as keyof typeof descriptions] || "content";
}

function assessReadability(content: string): string {
  const avgWordsPerSentence =
    content.split(/[.!?]+/).reduce((acc, sentence) => {
      return acc + sentence.split(/\s+/).length;
    }, 0) / content.split(/[.!?]+/).length;

  if (avgWordsPerSentence > 25) return "complex";
  if (avgWordsPerSentence > 15) return "moderate";
  return "simple";
}

function assessCompleteness(content: string, sourceType: string): string {
  const indicators = {
    youtube: ["[Music]", "...", "unclear", "inaudible"],
    pdf: ["[image]", "[table]", "[figure]", "continued on"],
    website: ["read more", "click here", "[image]", "see more"],
    code: ["// TODO", "// FIXME", "...", "truncated"],
  };

  const sourceIndicators =
    indicators[sourceType as keyof typeof indicators] || [];
  const hasIncompleteMarkers = sourceIndicators.some((indicator) =>
    content.toLowerCase().includes(indicator.toLowerCase()),
  );

  return hasIncompleteMarkers ? "partial" : "complete";
}

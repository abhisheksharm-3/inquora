/**
 * Pure utility functions for retrieval strategies.
 * These are synchronous helpers that don't need to be Server Actions.
 */

/**
 * Gets dynamic strategy weights based on query intent.
 * Adjusts the balance between semantic, keyword, and contextual search.
 */
export function getDynamicWeights(intent: string): Record<string, number> {
  const defaultWeights = { semantic: 0.6, keyword: 0.3, contextual: 0.1, stepback: 0.15 };

  switch (intent) {
    case 'factual':
      return { semantic: 0.4, keyword: 0.6, contextual: 0.1, stepback: 0.1 };
    case 'analytical':
      return { semantic: 0.7, keyword: 0.2, contextual: 0.2, stepback: 0.2 };
    case 'comparative':
      return { semantic: 0.6, keyword: 0.3, contextual: 0.3, stepback: 0.3 };
    case 'inferential':
      return { semantic: 0.8, keyword: 0.1, contextual: 0.3, stepback: 0.2 };
    case 'procedural':
      return { semantic: 0.5, keyword: 0.5, contextual: 0.1, stepback: 0.1 };
    case 'creative':
      return { semantic: 0.7, keyword: 0.1, contextual: 0.4, stepback: 0.3 };
    default:
      return defaultWeights;
  }
}

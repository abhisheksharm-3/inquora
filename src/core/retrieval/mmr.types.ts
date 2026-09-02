export interface Candidate {
  id: string;
  /** The chunk's embedding, as stored. Length is not checked here; callers share one model. */
  embedding: number[];
  /** Relevance to the query, higher is better. The fused score from `search_chunks`. */
  score: number;
}

export interface MmrOptions {
  /**
   * Weight on relevance against diversity. 1 is pure relevance, 0 is pure
   * diversity. The design settles on 0.3 read as relevance-dominant, which is
   * what the old engine got backwards: it passed `diversityThreshold: 0.7` as
   * lambda, giving diversity more than double the weight of relevance.
   */
  lambda: number;
  limit: number;
}

import type { Profile } from "./config.ts";

export type ArticleId = string; // canonical ID, shared by all translations

export interface Article {
  id: ArticleId;
  publisherId: string;
  communityIds: string[];
  languages: string[];
  originalLanguage: string;
  publishedAt: Date;
  status: "published" | "withdrawn" | "embargoed";
  contentType: "article" | "video" | "audio";
  topics: string[];
}

export interface ScoringContext {
  now: Date;
  profile: Profile;
  /** Total reads per article in the profile's popularity window. */
  reads: Map<ArticleId, number>;
  anchor?: Article;
}

/** Inclusive range of UTC days, formatted YYYY-MM-DD. */
export interface DayRange {
  fromDay: string;
  toDay: string;
}

/** Scores the whole candidate set at once (D5). Every score lies in [0, 1]. */
export interface Criterion {
  id: string;
  score(candidates: Article[], ctx: ScoringContext): Map<ArticleId, number>;
}

export interface Candidate {
  article: Article;
  /** Every pool that returned this article. */
  sourcePools: string[];
}

export interface BreakdownEntry {
  score: number;
  weight: number;
  contribution: number;
}

export interface ScoredCandidate extends Candidate {
  finalScore: number;
  breakdown: Record<string, BreakdownEntry>;
}

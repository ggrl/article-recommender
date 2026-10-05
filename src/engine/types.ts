import { z } from "zod";
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

/** Aggregate reads per article and day; no user IDs. */
export interface ReadAggregate {
  articleId: ArticleId;
  day: string; // YYYY-MM-DD
  reads: number;
}

export interface EditorPin {
  articleId: ArticleId;
  note: string;
  position: number; // 0-based slot in the final list
  startsAt: Date;
  expiresAt: Date;
  languages?: string[];
  regions?: string[];
}

/** Hard filters, built by the engine and applied inside every pool query (D4). */
export interface CandidateFilter {
  statuses: Article["status"][];
  languages: string[];
  excludeIds: ArticleId[];
  publishedSince: Date; // inclusive
}

export const userContextSchema = z.strictObject({
  userId: z.string().min(1).optional(), // anonymous users must work
  language: z.string().min(1),
  fallbackLanguages: z.array(z.string().min(1)),
  topicInterests: z.record(z.string(), z.number().min(0)),
  followedCommunities: z.array(z.string()),
  followedPublishers: z.array(z.string()),
  readArticleIds: z.array(z.string()),
  region: z.string().min(1).optional(), // explicit user setting, not IP-derived
});
export type UserContext = z.infer<typeof userContextSchema>;

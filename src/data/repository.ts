import type { Article, ArticleId, CandidateFilter, DayRange, EditorPin } from "../engine/types.ts";

/** Storage behind the engine. Every pool query applies the filter before the size limit. */
export interface Repository {
  /** Newest first. */
  recent(filter: CandidateFilter, limit: number): Promise<ArticleId[]>;
  /** Most reads in the window first; articles without reads in the window are left out (D10). */
  popular(filter: CandidateFilter, window: DayRange, limit: number): Promise<ArticleId[]>;
  /** At least one topic shared with the anchor; newest first. */
  similar(anchor: Article, filter: CandidateFilter, limit: number): Promise<ArticleId[]>;
  /** Same publisher or a shared community; newest first. */
  sameSource(anchor: Article, filter: CandidateFilter, limit: number): Promise<ArticleId[]>;
  /** Known IDs only, in the order asked. */
  getArticles(ids: ArticleId[]): Promise<Article[]>;
  /** Total reads per article within the window; articles without reads are absent. */
  getReads(ids: ArticleId[], window: DayRange): Promise<Map<ArticleId, number>>;
  listPins(): Promise<EditorPin[]>;
}

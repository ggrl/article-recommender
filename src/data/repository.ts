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
  /** From a followed publisher or a followed community; newest first. */
  follows(filter: CandidateFilter, publishers: string[], communities: string[], limit: number): Promise<ArticleId[]>;
  /** At least one of the given topics; newest first. */
  topics(filter: CandidateFilter, topics: string[], limit: number): Promise<ArticleId[]>;
  /** No topic in `topics`, not from a publisher in `publishers`, no community in `communities`; newest first. */
  unmatched(
    filter: CandidateFilter,
    topics: string[],
    publishers: string[],
    communities: string[],
    limit: number,
  ): Promise<ArticleId[]>;
  /** Known IDs only, in the order asked. */
  getArticles(ids: ArticleId[]): Promise<Article[]>;
  /** Total reads per article within the window; articles without reads are absent. */
  getReads(ids: ArticleId[], window: DayRange): Promise<Map<ArticleId, number>>;
  listPins(): Promise<EditorPin[]>;
}

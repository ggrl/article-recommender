import type { Article } from "./types.ts";

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Newest first; equal dates fall back to the lower ID so the order is deterministic (D7). */
export function newestFirst(a: Article, b: Article): number {
  return b.publishedAt.getTime() - a.publishedAt.getTime() || compareIds(a.id, b.id);
}

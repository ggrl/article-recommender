import { readFileSync } from "node:fs";
import { parseConfig, type Config } from "../src/engine/config.ts";
import type { Article, EditorPin, ScoringContext, UserContext } from "../src/engine/types.ts";

export function loadDefaultConfig(): Config {
  return parseConfig(JSON.parse(readFileSync(new URL("../config/default.json", import.meta.url), "utf8")));
}

export const NOW = new Date("2026-10-05T12:00:00Z");
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR_MS);
}

export function makeArticle(overrides: Partial<Article> & { id: string }): Article {
  return {
    publisherId: "p1",
    communityIds: [],
    languages: ["en"],
    originalLanguage: "en",
    publishedAt: hoursAgo(1),
    status: "published",
    contentType: "article",
    topics: [],
    ...overrides,
  };
}

export function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return { now: NOW, profile: loadDefaultConfig().profiles.feed, user: makeUser(), reads: new Map(), ...overrides };
}

export function makeUser(overrides: Partial<UserContext> = {}): UserContext {
  return {
    language: "en",
    fallbackLanguages: [],
    topicInterests: {},
    followedCommunities: [],
    followedPublishers: [],
    readArticleIds: [],
    ...overrides,
  };
}

export function makePin(overrides: Partial<EditorPin> & { articleId: string }): EditorPin {
  return {
    note: "Editor's pick",
    position: 0,
    startsAt: hoursAgo(24),
    expiresAt: new Date(NOW.getTime() + DAY_MS),
    ...overrides,
  };
}

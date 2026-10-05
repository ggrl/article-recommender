import { toDay } from "../engine/scoring/popularity.ts";
import type { Article, EditorPin, Publisher, ReadAggregate, UserContext } from "../engine/types.ts";

const DAY_MS = 86_400_000;
const COUNTRIES = ["AT", "BE", "CZ", "DE", "ES", "FR", "HR", "HU", "IT", "NL", "PL", "SI"];
const LANGUAGES = ["en", "de", "fr", "it", "es", "pl", "hr", "nl"];
const TOPICS = [
  "politics", "climate", "culture", "economy", "migration", "health", "technology", "education",
  "sport", "science", "gardening", "media", "housing", "energy", "travel",
];
const CONTENT_TYPES = ["article", "article", "article", "video", "audio"] as const;

export interface SeedData {
  publishers: Publisher[];
  articles: Article[];
  reads: ReadAggregate[];
  pins: EditorPin[];
  users: UserContext[];
}

/** mulberry32: a small seeded generator, so the same seed always gives the same data. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic data only: no real publishers, people or reading histories. */
export function generateSeed(seed: number, now: Date): SeedData {
  const rng = createRng(seed);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const sample = <T>(items: readonly T[], n: number): T[] => {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };
  const code = (prefix: string, n: number, width: number) => `${prefix}${String(n).padStart(width, "0")}`;

  const communities = Array.from({ length: 20 }, (_, i) => code("c", i + 1, 2));
  const publishers: Publisher[] = Array.from({ length: 30 }, (_, i) => ({
    id: code("p", i + 1, 2),
    name: `Example Press ${i + 1}`,
    country: COUNTRIES[i % COUNTRIES.length],
  }));

  const articles = Array.from({ length: 2000 }, (_, i): Article => {
    const originalLanguage = pick(LANGUAGES);
    const roll = rng();
    return {
      id: code("a", i + 1, 4),
      publisherId: pick(publishers).id,
      communityIds: sample(communities, int(0, 2)),
      languages: [originalLanguage, ...sample(LANGUAGES.filter((l) => l !== originalLanguage), int(0, 4))],
      originalLanguage,
      publishedAt: new Date(now.getTime() - Math.floor(rng() * 90 * DAY_MS)),
      status: roll < 0.95 ? "published" : roll < 0.98 ? "withdrawn" : "embargoed",
      contentType: pick(CONTENT_TYPES),
      topics: rng() < 0.05 ? [] : sample(TOPICS, int(1, 3)),
    };
  });

  // Long tail: raising to the 4th power leaves most articles with few reads and a handful with many.
  const reads: ReadAggregate[] = [];
  for (const article of articles) {
    const base = Math.floor(500 * rng() ** 4);
    for (let d = 0; d < 14; d++) {
      const day = new Date(now.getTime() - d * DAY_MS);
      if (day.getTime() < article.publishedAt.getTime()) break;
      const count = Math.floor(base * rng());
      if (count > 0) reads.push({ articleId: article.id, day: toDay(day), reads: count });
    }
  }

  // Pins pass the feed filters (D16), so they point at recent English articles the cold-start user can see.
  const pinnable = articles.filter(
    (a) => a.status === "published" && a.languages.includes("en") && a.publishedAt.getTime() > now.getTime() - 30 * DAY_MS,
  );
  const pins: EditorPin[] = [0, 3].map((position, i) => ({
    articleId: pinnable[i].id,
    note: i === 0 ? "Editor's pick" : "Featured this week",
    position,
    startsAt: new Date(now.getTime() - DAY_MS),
    expiresAt: new Date(now.getTime() + 6 * DAY_MS),
  }));

  const published = articles.filter((a) => a.status === "published");
  const readIds = (n: number) => sample(published, n).map((a) => a.id);
  const users: UserContext[] = [
    // users[0]: anonymous cold start
    { language: "en", fallbackLanguages: [], topicInterests: {}, followedCommunities: [], followedPublishers: [], readArticleIds: [] },
    { userId: "u1", language: "de", fallbackLanguages: ["en"], topicInterests: { climate: 0.5, energy: 0.3 }, followedCommunities: ["c01"], followedPublishers: ["p01"], readArticleIds: readIds(10) },
    { userId: "u2", language: "hr", fallbackLanguages: ["en", "de"], topicInterests: { culture: 0.3, gardening: 0.3 }, followedCommunities: [], followedPublishers: ["p05"], readArticleIds: readIds(25), region: "HR" },
    { userId: "u3", language: "fr", fallbackLanguages: [], topicInterests: { politics: 0.6 }, followedCommunities: ["c07", "c12"], followedPublishers: [], readArticleIds: [] },
    { userId: "u4", language: "it", fallbackLanguages: ["en"], topicInterests: {}, followedCommunities: [], followedPublishers: [], readArticleIds: readIds(50) },
  ];

  return { publishers, articles, reads, pins, users };
}

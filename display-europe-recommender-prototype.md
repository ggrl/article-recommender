# Display Europe Recommender: Prototype Plan and Work Order

---

## Part 1: Prototype summary

### Goal

Build a working prototype of the recommendation engine that serves both the personalised **newsfeed** and **"read next"** suggestions from one shared engine. The prototype proves the architecture and gives the client something concrete to react to while technical questions are still open. It is written so it can grow into the production engine rather than be thrown away.

### Architecture in one paragraph

A request (feed: user context; read next: user context plus current article) goes through **candidate selection**: a union of small, cheap retrieval pools, with shared hard filters. **Stage 1** gives every candidate a normalised score per criterion and combines them with configurable weights. Any criterion can be switched off by setting its weight to 0. **Stage 2** assembles the final list: optional quota slots (topics, follows, surprise), editor pins at fixed positions, and diversity rules (publisher caps, no duplicate translations). The output is a ranked list with a logged score breakdown and human-readable reasons.

### Key decisions so far

| Topic | Decision | Status |
|---|---|---|
| Engine language | TypeScript, matching the client's stack | Decided |
| NLP and enrichment (topics, embeddings, locations) | Separate Python batch jobs writing to the article index | Pending client agreement |
| Interface between the two | Database / article index only, no service calls | Proposed |
| Quotas vs. weights | Two-stage engine; quotas are optional and switchable | Needs client confirmation |
| Translations | One canonical article ID; translations are versions, never separate candidates | Proposed |
| Popularity data | Aggregate read counts per article and day only, no per-user logs needed | Proposed (GDPR) |
| Cold start | Non-personalised default feed (recency, popularity, pins, exploration) | Proposed |

### Phases

| Phase | Scope | Rough effort* |
|---|---|---|
| 1 | Engine skeleton, candidate pools, recency, popularity, editor pins, configurable weights, explanations, feed and simple read next, tests, seed data | 6–8 dev days |
| 2 | Topics and follows criteria, quota slot filling, surprise / exploration pool, diversity rules | 5–7 dev days |
| 3 | Python enrichment: topic tagging, multilingual embeddings for read next, location extraction from article text | 8–12 dev days, highly dependent on client data |
| Later | Production integration: client DB adapter, hosting, monitoring, offline evaluation harness | Not estimable until tech-lead questions are answered |

\*Estimates are for a developer working with a coding agent, including review and testing. They assume clean seed data. Real client data quality may change them significantly.

### Open dependencies (blocking production, not the prototype)

- Client tech stack, hosting and database (Postgres? pgvector allowed?)
- Real data access: article schema, existing topic tags, read/click data, user follows
- Whether Python jobs may run in their infrastructure
- Confirmation of quota semantics ("30% of the feed" = guaranteed share or a ranking bias?)
- Definition of "surprise" items
- GDPR constraints on reading history (possible Art. 9 special-category inferences)
- Languages and fallback rules

---

## Part 2: Work order for the coding agent

### 2.1 Context

You are building a prototype recommendation engine for a multilingual, non-profit European news platform. Articles exist in many translations. The platform values transparency, diversity and privacy, so the engine must be explainable (no black-box models) and must work with minimal user data.

There is **no access to real client data yet**. Build against a repository interface with an in-memory implementation and a seed-data generator. Never hardcode assumptions about the client's database.

### 2.2 Tech constraints

- TypeScript (strict mode), Node.js LTS
- Package manager: pnpm (or npm if simpler)
- Tests: Vitest
- Config validation: Zod
- HTTP demo layer: Fastify, kept thin and separate from engine code
- No ML or NLP libraries in this repo. Topics, embeddings and locations are treated as **precomputed fields** on articles.
- Deterministic behaviour: inject `now` and a seeded RNG everywhere. Never call `Date.now()` or `Math.random()` inside engine code.

### 2.3 Repository layout

```
/src
  /engine
    types.ts             # domain types (below)
    config.ts            # Zod schemas, default profiles
    candidates.ts        # filters + retrieval pools
    scoring/
      recency.ts
      popularity.ts
      topics.ts          # phase 2
      follows.ts         # phase 2
      similarity.ts      # read next (tag overlap now, embeddings later)
      index.ts           # registry + weighted sum
    assembly/
      quotas.ts          # phase 2
      pins.ts
      diversity.ts
      index.ts
    explain.ts           # reasons from breakdown
    recommend.ts         # public entry point
  /data
    repository.ts        # interface
    memoryRepository.ts  # in-memory implementation
    seed.ts              # synthetic data generator
  /http
    server.ts            # demo endpoints
/test
/config
  default.json           # weights, quotas, pins source
README.md
```

### 2.4 Domain types (starting point, adjust if needed)

```ts
type ArticleId = string;  // canonical ID, shared by all translations

interface Article {
  id: ArticleId;
  publisherId: string;
  communityIds: string[];
  languages: string[];         // available translations, e.g. ["en","de","hr"]
  originalLanguage: string;
  publishedAt: Date;
  status: "published" | "withdrawn" | "embargoed";
  contentType: "article" | "video" | "audio";
  topics: string[];            // precomputed; may be empty
  locations?: { country?: string; region?: string }[]; // phase 3, may be absent
}

interface Publisher {
  id: string;
  name: string;
  country: string;
  region?: string;
  lat?: number;
  lon?: number;
}

interface ReadAggregate {        // aggregate only, no user IDs
  articleId: ArticleId;
  day: string;                   // YYYY-MM-DD
  reads: number;
}

interface UserContext {
  userId?: string;               // optional: anonymous users must work
  language: string;
  fallbackLanguages: string[];
  topicInterests: Record<string, number>; // e.g. { gardening: 0.3, culture: 0.3 }
  followedCommunities: string[];
  followedPublishers: string[];
  readArticleIds: ArticleId[];   // optional, may be empty
  region?: string;               // explicit user setting, not IP-derived
}

interface EditorPin {
  articleId: ArticleId;
  note: string;
  position: number;              // 0-based slot in the final list
  startsAt: Date;
  expiresAt: Date;
  languages?: string[];          // targeting, optional
  regions?: string[];
}
```

### 2.5 Public API

```ts
recommend(request: {
  mode: "feed" | "readNext";
  user: UserContext;
  anchorArticleId?: ArticleId;   // required for readNext
  limit: number;
  now: Date;
  seed?: number;
}): Promise<{
  items: {
    articleId: ArticleId;
    rank: number;
    finalScore: number | null;   // null for pins
    breakdown: Record<string, { score: number; weight: number; contribution: number }>;
    sourcePools: string[];
    slotType: "ranked" | "quota" | "pin" | "surprise";
    reasons: string[];
    pinNote?: string;
  }[];
  meta: { configVersion: string; candidateCount: number; profile: string };
}>
```

HTTP demo: `POST /recommend` with the same body, and `GET /health`.

### 2.6 Configuration

One JSON file, validated with Zod on load. Two profiles, `feed` and `readNext`, each with:

```json
{
  "version": "2026-10-proto-1",
  "profiles": {
    "feed": {
      "maxAgeDays": 60,
      "pools": { "recent": 150, "popular": 100, "follows": 100, "topics": 100, "exploration": 60 },
      "weights": { "recency": 1.0, "popularity": 0.6, "topics": 0.8, "follows": 0.8 },
      "recency": { "halfLifeHours": 48 },
      "popularity": { "windowDays": 7, "normalisePerPublisher": false },
      "quotas": { "enabled": false, "topics": {}, "follows": { "communities": 0.4, "publishers": 0.4 }, "surprise": 0.2 },
      "diversity": { "maxPerPublisher": 3 }
    },
    "readNext": {
      "maxAgeDays": 365,
      "pools": { "similar": 100, "sameSource": 50, "popular": 30 },
      "weights": { "similarity": 1.0, "recency": 0.3, "popularity": 0.3 },
      "recency": { "halfLifeHours": 336 },
      "popularity": { "windowDays": 14, "normalisePerPublisher": false },
      "quotas": { "enabled": false },
      "diversity": { "maxPerPublisher": 2 }
    }
  }
}
```

A weight of 0 or a missing key means the criterion is **off**: it is not computed and not shown in reasons.

### 2.7 Candidate selection

1. **Hard filters (both modes):** `status === "published"`; available in `user.language` or a fallback language; not in `user.readArticleIds`; age ≤ `maxAgeDays`. In read next, also exclude the anchor article.
2. **Pools.** Each pool is a separate repository query returning up to N IDs:
   - feed: `recent`, `popular`, `follows`, `topics`, `exploration` (articles matching none of the user's topics or follows, sampled with the seeded RNG from the recent window)
   - readNext: `similar` (phase 1: topic-tag overlap with the anchor; later: embedding neighbours), `sameSource` (same publisher or community), `popular`
3. **Union** by article ID, recording every pool that returned the article (`sourcePools`).
4. Empty pools are normal (cold start). The union must still return a sensible set.

Pools decide **eligibility**. They are not a ranking.

### 2.8 Stage 1: scoring

All criterion scores lie in [0, 1].

- **recency** = `2 ^ (-ageHours / halfLifeHours)`
- **popularity** = `log(1 + reads) / log(1 + maxReads)`, where `reads` is the sum over the window and `maxReads` is the maximum across the current candidate set. If `normalisePerPublisher` is set, divide by the publisher's maximum instead. Zero reads gives 0.
- **topics** (phase 2) = `min(1, Σ topicInterests[t] for t in article.topics) / maxInterest`, so that the user's strongest interest maps to 1. Users without interests get 0.
- **follows** (phase 2) = `1` if any community or the publisher is followed, else `0`. Keep which one matched for the explanation.
- **similarity** (read next) = Jaccard overlap of topic tags with the anchor, plus `0.3` if same publisher or community, clipped to 1. Must be replaceable by embedding cosine similarity later without touching other code.

**Final score** = `Σ (wᵢ · sᵢ) / Σ wᵢ` over enabled criteria. Store the full breakdown per item.

Each criterion is a module implementing one interface (`id`, `compute(article, context) → number`) registered in a registry, so new criteria (location) plug in without changing the engine.

### 2.9 Stage 2: assembly

Order of operations:

1. **Pins:** load active pins (`startsAt ≤ now < expiresAt`, targeting matches). Reserve their positions. Pins are excluded from the ranked pool and **ignore all scores and filters except language availability.**
2. **Quotas** (phase 2, only if `quotas.enabled`): for the remaining `limit − pins` slots, compute target counts per bucket (`round(share × slots)`). Fill each bucket with its highest-scored candidates. A candidate counts for at most one bucket. If a bucket has too few candidates, leave its slots for step 3. Never fail.
3. **Fill:** fill the remaining slots from the global ranking by final score.
4. **Diversity**, applied during steps 2–3: skip a candidate if its publisher has reached `maxPerPublisher`.
5. **Order:** sort the selected non-pinned items by final score, then insert pins at their positions.

### 2.10 Explanations

- Pins: `reasons = [pin.note]`, `slotType = "pin"`.
- Surprise slots: "Something outside your usual topics".
- Otherwise, take the 1–2 criteria with the highest `contribution` (weight × score) and map them to templates:
  - recency → "New"
  - popularity → "Popular this week" (use the configured window in the text)
  - topics → "Matches your interest in {topic}"
  - follows → "From {community/publisher} you follow"
  - similarity → "Related to the article you're reading"
- Templates live in one file and are keyed for later translation.

### 2.11 Seed data

`seed.ts` generates deterministic synthetic data from a seed: about 30 publishers in 12 countries, 2,000 articles over 90 days in 5–8 languages, 15 topics, 20 communities, read aggregates with a long-tail distribution, 5 sample user contexts (including one anonymous cold-start user), and 2 active pins. Seed data must contain **no real personal data**.

### 2.12 Tests (required)

- Every scoring function: boundaries, empty inputs, monotonicity (newer → higher recency).
- Weight 0 removes the criterion from score and reasons.
- Translations never appear as duplicates.
- Pins appear at their position, regardless of score; expired pins never appear.
- Publisher cap respected.
- Quotas: shares met when enough candidates exist; graceful fill when not.
- Cold-start user gets a full-length feed.
- Read next never returns the anchor article.
- Determinism: same request + same seed gives identical output.
- Performance smoke test: feed for 2,000 articles in under 100 ms on in-memory data.

### 2.13 Deliverables and acceptance criteria

**Phase 1 is done when:**
- [ ] `pnpm test` passes, with strict TypeScript and no `any` in engine code
- [ ] `recommend()` works for `feed` and `readNext` with recency, popularity, similarity and pins
- [ ] Config is validated; an invalid config fails loudly at startup
- [ ] Every item carries a breakdown and at least one reason
- [ ] The HTTP demo runs locally against seed data
- [ ] README explains setup, config, how to add a criterion, and known limitations

**Phase 2 is done when:**
- [ ] Topics and follows criteria implemented and tested
- [ ] Quota assembly implemented behind `quotas.enabled`
- [ ] Exploration pool feeds the surprise slots

### 2.14 Out of scope for the agent

- Any NLP, embeddings or location extraction (phase 3, Python, separate repo)
- Connecting to client systems or real data
- Authentication, user management, frontend UI
- Storing per-user reading logs beyond the `readArticleIds` passed in the request
- Collaborative filtering or any trained model

### 2.15 Working rules

- Work in small commits, one module at a time, with tests in the same commit.
- If a spec detail is ambiguous, choose the simplest option, note it in `DECISIONS.md`, and continue.
- Keep the engine free of framework, HTTP and storage specifics. Only `/http` and `/data` may know about those.

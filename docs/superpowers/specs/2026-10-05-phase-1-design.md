# Phase 1 design

The spec is `display-europe-recommender-prototype.md` (the work order). This note
covers only what the work order leaves open for phase 1. Rulings on ambiguous
details live in `DECISIONS.md`; "D4" here means entry 4 there.

## Scope

Phase 1 as listed in work order 2.13: engine skeleton, `recent` and `popular` feed
pools, `similar`, `sameSource` and `popular` read next pools, recency, popularity and
similarity criteria, editor pins (feed only, D3), publisher cap, configurable weights,
explanations, HTTP demo, seed data, tests. Topics, follows, quotas, exploration and
surprise slots are phase 2 and get their own design.

## Structure

Folders follow work order 2.3, minus the phase 2 files (`topics.ts`, `follows.ts`,
`quotas.ts`).

**Entry point.** `createRecommender({ repository, config })` validates the config
and returns `{ recommend }`. An invalid config throws here, so it fails at startup.
`recommend(request)` takes the request from work order 2.5 without `seed` (D9).

**One request:**

1. Validate the request with Zod (limits in D7). `readNext` needs an `anchorArticleId` that exists.
2. Pick the profile (config rules in D6). Build one `CandidateFilter` from user and profile.
3. Run every pool whose configured size is above 0, in parallel.
4. Union by ID, recording `sourcePools`. Load articles and read totals for the set.
5. Score with every criterion whose weight is above 0; combine by weighted sum.
6. Assemble: pins at their positions (feed only, placement in D8), then remaining slots by score
   under the publisher cap, then order.
7. Explain each item and return it with `meta`.

**Hard filters as data (D4).** `candidates.ts` builds a `CandidateFilter`:

```ts
interface CandidateFilter {
  statuses: Article["status"][];   // ["published"]
  languages: string[];             // user.language + fallbackLanguages
  excludeIds: ArticleId[];         // readArticleIds, plus the anchor in readNext
  publishedSince: Date;            // now - maxAgeDays, inclusive
}
```

Each pool query takes the filter and a size and returns up to that many matching IDs,
so pools are full-size after filtering. The engine defines the rule; a repository
only executes it (the in-memory one as a predicate, a later SQL adapter as `WHERE`).

**Repository interface** (`src/data/repository.ts`):

- pools: `recent(filter, n)`, `popular(filter, fromDay, toDay, n)`,
  `similar(anchor, filter, n)` (shares at least one topic, newest first),
  `sameSource(anchor, filter, n)` (same publisher or a shared community, newest first)
- loads: `getArticles(ids)`, `getPublishers(ids)`, `getReads(ids, fromDay, toDay)`,
  `listPins()`

Which pin is active and which days fall in the window are engine decisions.

**Criteria score the whole candidate set (D5).**

```ts
interface Criterion {
  id: string;
  score(candidates: Article[], ctx: ScoringContext): Map<ArticleId, number>;
}
```

`ScoringContext` carries `now`, the profile, the anchor (read next) and the read
totals. Criteria are registered in `scoring/index.ts`; the engine runs only those
with weight above 0.

## Errors

- Invalid config: `createRecommender` throws the Zod error; the HTTP server exits.
- Invalid request (bad fields, missing or unknown anchor): `RequestError`, HTTP 400.
  A withdrawn anchor is still a valid anchor; filters apply to candidates only.
- Empty pools are normal and give a shorter list, never an error.
- Repository failures propagate; HTTP 500.

## Determinism

The engine never reads the clock or `Math.random()`. Phase 1 has no randomness in
the engine. `seed.ts` uses a small inline seeded generator. Over HTTP, `now` is an
optional ISO string; when absent, `/http` substitutes the server clock.

## Testing

- Vitest. Exact assertions run against small hand-built fixtures in the in-memory
  repository, so every test shows its inputs.
- Seed data is used only for the scale tests: cold-start full-length feed,
  determinism, and the 100 ms smoke test (measured after one warm-up run).
- All phase 1 tests from work order 2.12; quota tests wait for phase 2.

## Tooling

- `npm run verify`: type check, then ESLint with `typescript-eslint` (catches an
  explicit `any`, which strict TypeScript allows), then tests. Recorded in AGENTS.md
  section 8 once it exists.
- Running `.ts` directly: to be checked against Node 22.23 in the plan; `tsx` if not.

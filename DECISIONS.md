# Decisions

Settled rulings. To change one, add a new entry that supersedes it; never edit an
old ruling silently.

## 1. npm as the package manager (2026-10-05)

- **Context:** the work order allowed "pnpm (or npm if simpler)". pnpm is not
  installed here; npm is, and the maintainer has used it before.
- **Decision:** npm. The verify command builds on `npm test`.
- **Alternatives considered:** pnpm via corepack. Nothing in the plan needs it.
- **Consequences:** `package-lock.json` is the committed lockfile.

## 2. Phase 1 scope only (2026-10-05)

- **Context:** the work order splits the engine into phases; quota semantics are
  still an open client question.
- **Decision:** this cycle builds phase 1 only. Phase 2 gets its own design.
- **Alternatives considered:** phases 1 and 2 together.
- **Consequences:** interfaces stay open for topics, follows and quotas.

## 3. Editor pins apply to the feed only (2026-10-05)

- **Context:** `EditorPin` has no mode field. A pin in read next would appear under
  every article, unrelated to the anchor.
- **Decision:** pins are assembled in feed mode only.
- **Alternatives considered:** both modes; a per-pin `modes` field.
- **Consequences:** an optional `modes` field can be added later without breaking
  anything.

## 4. Hard filters defined by the engine, applied inside pool queries (2026-10-05)

- **Context:** filtering after a size-limited pool query shrinks pools for heavy
  readers.
- **Decision:** the engine builds a `CandidateFilter`; every pool query takes it.
- **Alternatives considered:** engine filters raw lists afterwards (pools come back
  short); repository returns the whole age window (pools stop being queries).
- **Consequences:** each repository implementation translates the filter.

## 5. Criteria score the whole candidate set (2026-10-05)

- **Context:** popularity normalises by the maximum across the candidate set; a
  per-article `compute(article, context)` would recompute it per candidate.
- **Decision:** `score(candidates, ctx) -> Map<ArticleId, number>`.
- **Alternatives considered:** the work order's per-article signature.
- **Consequences:** embedding similarity later fits the same shape.

## 6. Strict config keys (2026-10-05)

- **Context:** a misspelt criterion with a missing key would silently be off.
- **Decision:** unknown keys in the config are a startup error. Phase 1 knows the
  criteria `recency`, `popularity`, `similarity` and the pools `recent`, `popular`,
  `similar`, `sameSource`. At least one weight must be above 0. The phase 1 feed
  default is `recency 1.0, popularity 0.6`.
- **Alternatives considered:** accept and ignore unknown keys.
- **Consequences:** phase 2 adds its keys and the `quotas` block to the schema.

## 7. Ranking details (2026-10-05)

- **Decision:** equal final scores rank newer first, then lower `articleId`.
  `limit` is an integer from 1 to 100. The popularity window is the last
  `windowDays` UTC days including today; the reason reads "Popular this week" for 7
  days, else "Popular in the last N days".
- **Alternatives considered:** none worth recording.
- **Consequences:** output is fully deterministic; the demo endpoint cannot be
  asked for the whole catalogue.

## 8. Pin placement (2026-10-05)

- **Decision:** a pin is active when `startsAt <= now < expiresAt`, the article is
  available in one of the user's languages, and its targeting matches; a
  region-targeted pin does not match a user without a region. On a position clash
  the earlier `startsAt` keeps the slot and the other moves to the next free slot.
  A position at or beyond `limit` is not shown; if the list is shorter than the
  position, the pin goes at the end. Pins do not count toward the publisher cap and
  carry an empty breakdown with `finalScore: null`.
- **Alternatives considered:** dropping clashing pins.
- **Consequences:** no editor pin is lost to a clash.

## 9. No request `seed` in phase 1 (2026-10-05)

- **Context:** phase 1 has no randomness in the engine.
- **Decision:** the request has no `seed` field until phase 2 needs it.
- **Alternatives considered:** accept and ignore it.
- **Consequences:** adding the optional field later is not breaking.

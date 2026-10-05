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

## 10. The popular pool leaves out articles without reads (2026-10-05)

- **Context:** the work order says the popular pool returns up to N IDs but not
  what fills it when fewer than N articles have reads.
- **Decision:** only articles with at least one read in the window qualify.
- **Alternatives considered:** padding with zero-read articles.
- **Consequences:** "popular" in `sourcePools` always means read at least once; the
  recent pool still covers cold start.

## 11. Pin language targeting matches the main language (2026-10-05)

- **Context:** `EditorPin.languages` targets languages, but a user has a main
  language and fallbacks.
- **Decision:** a language-targeted pin matches only the user's main language.
  Availability of the pinned article still accepts fallbacks.
- **Alternatives considered:** matching fallbacks too.
- **Consequences:** a pin aimed at Croatian readers is not shown to a German reader
  with Croatian as a fallback.

## 12. Generic reason when no criterion contributed (2026-10-05)

- **Context:** every item needs at least one reason (work order 2.13), but an item
  can score 0 on every enabled criterion, for example a recent-pool article with no
  reads when recency is switched off.
- **Decision:** such an item gets "Recommended for you".
- **Alternatives considered:** naming the top criterion even at 0, which would state
  something false ("Popular this week" with no reads).
- **Consequences:** reasons never claim a signal that is not there.

## 13. Seed languages (2026-10-05)

- **Context:** work order 2.11 asks for articles "in 5-8 languages", which reads
  either as the corpus or as each article.
- **Decision:** the corpus has 8 languages; each article has its original plus 0 to
  4 translations.
- **Alternatives considered:** every article in 5 to 8 languages, which would make
  the language filter almost never exclude anything.
- **Consequences:** language filtering and fallbacks have a visible effect in the
  demo.

## 14. ESLint skips the agent tooling folders (2026-10-05)

- **Context:** `.agents/` and `.claude/` are gitignored agent tooling that ships its
  own browser and CommonJS scripts. ESLint flat config does not read `.gitignore`, so
  `npm run lint` failed with 219 errors that were not project code.
- **Decision:** `eslint.config.js` ignores `.agents/**` and `.claude/**`.
- **Alternatives considered:** reading `.gitignore` via `@eslint/compat`, which adds a
  dependency for the same result.
- **Consequences:** removing the ignore line brings those errors back; a contributor
  without those folders sees no difference.

## 15. The similar pool stays newest-first (2026-10-05)

- **Context:** the final phase 1 review noted that the read-next `similar` pool takes
  the 100 newest articles sharing a topic with the anchor (work order 2.7), so an
  older close match can miss the pool. Estimated about 170 matches for 100 slots on
  seed data; not measured.
- **Decision:** keep it as the work order defines it, for now.
- **Alternatives considered:** order the pool by shared-topic count, then newest.
- **Consequences:** read next can miss older close matches unless the `sameSource`
  or `popular` pool finds them. Revisit when embeddings replace tag overlap.

## 16. Pins pass the hard filters (2026-10-05)

- **Context:** work order 2.9 says pins "ignore all scores and filters except language
  availability", so a pin on a withdrawn, embargoed, already-read or too-old article
  was still shown.
- **Decision:** supersedes that part of work order 2.9 and amends D8. Pins still
  ignore scores, the publisher cap and the pools, but their article must pass the
  same hard filter as every candidate (D4): published, in a language the user reads,
  not already read, not older than the feed's `maxAgeDays`. Pins and the in-memory
  repository share one predicate (`articleFilter` in `src/engine/candidates.ts`); a
  future SQL repository translates the same rule (D4).
- **Alternatives considered:** checking status only.
- **Consequences:** an editor's pin silently disappears once its article is
  withdrawn, read or ages out; seed pins point at recent articles.

## 17. Known demo security limits, accepted for now (2026-10-05)

- **Context:** the phase 1 security pass found two issues, neither reachable while
  the demo listens on 127.0.0.1 only.
- **Decision:** leave both unfixed until the demo is exposed beyond localhost or a
  real repository receives these lists:
  1. User-context arrays (`fallbackLanguages`, `readArticleIds`, follows) have no
     length limit. A request of about 1 MB with 240,000 fallback languages blocked
     the server for about 1 s (measured). Fix: `.max()` on those arrays in
     `userContextSchema` (`src/engine/types.ts`).
  2. A `now` at the edge of the Date range (for example `-271821-04-20`) returns
     500 "Invalid time value". Fix: range-check `now` in `recommendRequestSchema`.
- **Alternatives considered:** fixing now, which defends against a scenario that
  cannot happen on localhost.
- **Consequences:** exposing the demo publicly requires both fixes first. That
  includes indirect exposure: a container port mapping or a reverse proxy in front
  of the 127.0.0.1 listener counts as public.

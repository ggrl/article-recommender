# Work log

## 2026-10-06 (late) - Diagram and feed workbench page

- **What changed:** two additions outside the work order. (1) `docs/how-it-works.md`:
  a plain-language Mermaid flowchart of the engine (feed and read next, 9 boxes, no
  file names), linked from the README; a polished version is a private claude.ai
  page, https://claude.ai/artifact/Xn8Nby7FiWBF74dYsME5oN (not in the repo; update
  it by hand when the doc changes). (2) The feed workbench: `npm start`, then
  `http://127.0.0.1:3000/`. `src/http/demo.ts` adds `GET /`, `GET /demo/options` and
  `POST /demo/feed` (posted feed weights and quotas laid over `config/default.json`,
  checked by `parseConfig`, one engine per request, response plus an `articles` map);
  `src/http/demo.html` is the page (plain JS, `textContent` only, no external
  resources). `main.ts` wires it. The engine did not change. Spec
  `docs/superpowers/specs/2026-10-06-demo-gui-design.md`, plan
  `docs/superpowers/plans/2026-10-06-demo-gui.md`, rulings D31 and D32.
- **Why:** the user wanted a picture of how the engine works and a simple page that
  shows it working with chosen weights and quotas. Local only (D31).
- **Verified:** `npm run verify` green on main after the merge and again at this
  save: 17 files, 195 tests, type check and lint clean. `test/demo.test.ts` proves
  the demo feed equals `POST /recommend` for the same reader, seed and now. The page
  was driven in headless Chrome over the DevTools protocol (the Chrome extension was
  not connected): initial feed with pins at ranks 1 and 4, weight 0, reader change,
  quotas on, shares over 1 (error shown, last feed kept), reset, quota inputs locked
  while off; no console errors. Task reviews clean; first-look UX review led to one
  fix wave; final review "ready to merge" plus one fix wave, both re-reviewed;
  security review SHIP (cross-site POSTs checked by real requests). Merged and pushed
  (`origin/main` at `58a4788`).
- **Not verified:** the Mermaid diagram has not been seen rendered (no local
  renderer; check it on GitHub). Nobody has used the page in a real, visible browser
  window. The security pass ran before the last fix commit, which changed only error
  wording and the pin sentence.
- **Parked on purpose:** no "updating" label during a refresh; pin rows show
  "pinned" with the note as the reason (spec says so); a negative topic share is
  ignored; Reset keeps reader and seed; hand-made bad requests (bad reader, unknown
  key) still get raw validation text; no Host check (D32).
- **Still open from before:** follow-quota items carry no follow reason when the
  follows weight is 0; client questions on quotas, surprise and weights (D24, D28).
- **Next step:** open the page and the GitHub diagram yourself; then tune weights
  with the workbench against the seed readers (D24), or wait for the client.
- **Surprises:** the UX review caught that the default quota shares already add up
  to 1, so any featured topic tipped the total over. The last fix commit carries a
  "Claude Sonnet 5" co-author line because that model wrote it.

## 2026-10-06 (later) - Phase 2b: quotas, exploration, surprise

- **What changed:** the request accepts an optional `seed`; without one the engine
  draws one, and every response returns it as `meta.seed` (D26, supersedes D9).
  `createRng` moved to `src/engine/rng.ts` (plus `randomSeed`, `sample`). New
  repository query `unmatched` (`src/data/repository.ts`, `memoryRepository.ts`)
  feeds the `exploration` pool in `feedPools` (`src/engine/candidates.ts`), sampled
  with the seed, queried only when quotas are on and `surprise` > 0 (D29). Quota
  assembly in new `src/engine/assembly/quotas.ts`; `diversity.ts` now has one
  shared `publisherCap` counter for reservation and fill. Config gains
  `pools.exploration` and a `quotas` block (`src/engine/config.ts`,
  `activeQuotas`), off in `config/default.json`. `slotType` is now
  `ranked | quota | surprise | pin`; new reasons in `explain.ts` (`slotReasons`).
  README updated. Design `docs/superpowers/specs/2026-10-06-phase-2b-design.md`,
  plan `docs/superpowers/plans/2026-10-06-phase-2b.md`, rulings D25 to D30.
- **Why:** rest of work order phase 2. The client still has not answered what a
  quota means; we built the work order's guaranteed share (D25), off by default, so
  nothing changes until someone switches it on. `quotas.topics` keys are editor-set
  featured topics (D27). Reserved items keep their place by score (D28).
- **Verified:** `npm run verify` green on main after the merge and again at this
  save: 16 files, 185 tests, type check and lint clean. Six subagent tasks, each with
  a task review (all clean); whole-branch review "ready to merge" plus one small fix
  wave (featured-topic order test, README sentence), re-reviewed; security review
  SHIP. The seed-data surprise test and the featured-topic order test were each
  proven able to fail by mutation. Fast-forward merged to main locally
  (`ab4bac8..60a7c41`).
- **Not verified:** nobody started the demo server and made a live request with
  quotas on; that path is covered only by the end-to-end and seed-data tests.
  **Not pushed:** local main is ahead of `origin/main`.
- **Open, for the user:** with the `follows` weight at 0, follow-quota items carry
  no follow reason (spec says they keep the usual reasons; left as is). Possible fix:
  a leading follow reason like featured topics have.
- **Open, for the client** (with D24): a featured-topic share fills only from
  candidates the pools found, so a niche topic can come up short; surprise items
  mostly sit at the end of the feed (D28).
- **Known and accepted:** echoed random seeds expose some `Math.random` output;
  harmless unless `Math.random` is later used for tokens or IDs. With quotas on, a
  huge follow list costs one more article scan (D23).
- **Next step:** push main; then either tune weights against seed users (D24) or
  wait for the client's answers on quotas and surprise.

## 2026-10-06 - Phase 2a: topics and follows

- **What changed:** the feed is personalised. New criteria `src/engine/scoring/topics.ts`
  and `follows.ts`; criteria may attach a `detail` to a score (`CriterionScore` in
  `src/engine/types.ts`, copied into the breakdown by `scoring/index.ts`);
  `ScoringContext` carries the user. New repository pools `follows` and `topics`
  (`src/data/repository.ts`, `memoryRepository.ts`), wired in `feedPools`
  (`src/engine/candidates.ts`) with size 0 when the user has nothing. New reasons in
  `src/engine/explain.ts`. Feed config gains `topics`/`follows` weights (0.8) and
  pools (100). README updated. Design `docs/superpowers/specs/2026-10-05-phase-2a-design.md`,
  plan `docs/superpowers/plans/2026-10-05-phase-2a.md`, rulings D18 to D24.
- **Why:** work order phase 2, first part. Phase 2 was split (D18): quotas,
  exploration and surprise slots are 2b, waiting on the client's quota semantics.
  The work order's topics formula could exceed 1; fixed to divide-then-clamp (D19).
- **Verified:** `npm run verify` green on main after merge and again at this save:
  15 files, 141 tests, type check and lint clean. Six subagent tasks, each with a
  task review; whole-branch review plus one fix wave, re-reviewed; security review
  SHIP. The ranking test was proven able to fail by mutation. A subagent ran the
  demo and got topic and follow reasons in a live response; I did not run it myself.
  Feed timing on seed data: about 1.2 ms cold start, 1.8 ms for user u1 (subagent
  measurement). Merged to main and pushed (`origin/main` at `732c582`).
- **Not verified:** no real client data. How much of a personalised feed is older
  than a few days was not measured (see D24).
- **Known and accepted:** with default weights, matched articles outrank fresh
  unmatched ones at almost any age (D24); weights get tuned later in
  `config/default.json`, raise with the client. Follow reasons are generic (D21).
  Topic names from the request are echoed in `detail` and reasons: safe as JSON,
  but a future frontend must escape them. Unbounded user lists stay accepted for the
  local demo (D17, D23).
- **Next step:** phase 2b (exploration pool, surprise slots, quotas) once the client
  answers what a quota means; or tune weights against seed users.
- **Surprises:** the plan's own ranking test passed without the feature (alphabetical
  IDs matched the expected order); the task review caught it. Some fix commits carry
  a "Claude Sonnet 5" co-author line because that model wrote them.

## 2026-10-05 (later) - Pins pass the hard filters

- **Answered the open questions from the entry below.** The `similar` pool stays
  newest-first (D15). The two demo security limits stay unfixed, with their fixes
  written down (D17). Pins must no longer show withdrawn, embargoed, already-read or
  too-old articles (D16, supersedes that part of work order 2.9).
- **What changed:** `articleFilter(filter)` in `src/engine/candidates.ts` is now the
  single hard-filter predicate; `src/data/memoryRepository.ts` and `activePins` in
  `src/engine/assembly/pins.ts` both use it. `src/engine/recommend.ts` builds the
  feed filter once and passes it to pools and pin loading. `src/data/seed.ts` picks
  pins from articles under 30 days old so the demo still shows them. README
  limitation about pins replaced by a local-only note pointing to D17.
- **Verified:** `npm run verify` green: 13 files, 112 tests, type check and lint
  clean. New tests failed before the fix (RED seen). A deliberate mutation (pins
  given the read-next filter) made the new end-to-end stale-pin test fail; reverted.
  Logic review and security review both passed with no blockers. Merged to main and
  pushed (`origin/main` at `1aa1323`).
- **Not verified:** the demo server was not started this time; the seed pins at
  ranks 1 and 4 are checked by `test/scale.test.ts`, not by a live request.
- **Next step:** brainstorm phase 2 (topics, follows, quotas, exploration, surprise
  slots). Quota semantics are still an open client question.
- **Note:** the phase 1 plan document still describes the old pin behaviour; it is
  historical, `DECISIONS.md` is the authority.

## 2026-10-05 - Setup and phase 1 engine

- **Setup.** Filled AGENTS.md section 8 (gitignored, local only): project summary,
  stack, public-repo note, verify command, run command, domain modules. Decisions now
  live in `DECISIONS.md` (not `docs/adr/`); the `start` and `save` skills in `.claude/`
  and `.agents/` were updated to match. npm instead of pnpm (D1).
- **Phase 1 built and merged to main, pushed** (`origin/main` at `0d02b4f`). Design:
  `docs/superpowers/specs/2026-10-05-phase-1-design.md`; plan:
  `docs/superpowers/plans/2026-10-05-phase-1.md`; rulings D2 to D13 in `DECISIONS.md`.
  Code: `src/engine` (candidates, scoring, assembly, explain, `recommend.ts` entry
  point), `src/data` (repository interface, in-memory repo, seed), `src/http` (demo).
- **How it was built:** 12 test-first tasks, each by a subagent with a separate spec
  and quality review, then a whole-branch review (one fix round: README accuracy,
  shared `availableIn` rule, two stronger tests), then the security pass.
- **Verified:** `npm run verify` green on main after merge and again at this save:
  13 test files, 101 tests, type check and lint clean. The demo server was started
  and exercised with curl by a subagent (health, feed with pins at ranks 1 and 4,
  read next without the anchor, broken config exits at startup); I did not run it
  myself. Feed on 2,000 seed articles: median about 1.2 ms (subagent measurement).
- **Not verified:** no real client data exists; everything runs on synthetic seed
  data. The `similar` pool size versus match count (about 170 matches for 100 slots)
  is a reviewer's estimate, not a measurement.
- **Open questions for the user:**
  1. Should the `similar` read-next pool order by shared-topic count before newness?
     Today it takes the 100 newest topic matches (work order 2.7), so an older close
     match can miss the pool. Changing it changes the spec.
  2. Pins ignore status, read history and age (work order 2.9 literal), so a pinned
     withdrawn or embargoed article is still shown. Documented in README; a status
     check is a one-line change if wanted.
- **Security notes (not fixed, no blocker while the demo binds to 127.0.0.1):**
  `fallbackLanguages` has no length limit, so a ~1 MB request blocks the server for
  about 1 s; a `now` at the edge of the Date range returns a 500 "Invalid time value".
  A `.max()` on the user-context arrays is the fix if the demo is ever exposed.
- **Next step:** answer the two open questions, then brainstorm phase 2 (topics,
  follows, quotas, exploration, surprise slots). Quota semantics are still an open
  client question.
- **Surprises:** typescript-eslint 8.71 supports TypeScript below 6.1 only, so
  TypeScript is pinned to ~6.0.3 although 7.0.2 is latest. ESLint flat config does
  not read `.gitignore`, so it linted the gitignored agent tooling until told not to
  (D14). History on main was rewritten once before the first push to fix malformed
  co-author trailers; hashes after `9e3f8d6` changed.

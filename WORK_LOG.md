# Work log

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

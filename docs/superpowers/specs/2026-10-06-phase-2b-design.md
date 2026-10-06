# Phase 2b design: quotas, exploration and surprise slots

The spec is `display-europe-recommender-prototype.md` (the work order). This note
covers only what the work order leaves open for phase 2b. Rulings live in
`DECISIONS.md`; "D25" here means entry 25 there. Earlier designs:
`2026-10-05-phase-1-design.md`, `2026-10-05-phase-2a-design.md`.

## Scope

The rest of phase 2 (D18): the request `seed`, the `exploration` feed pool (work
order 2.7), quota assembly behind `quotas.enabled` with surprise slots (2.9), and
their reasons and slot types (2.5, 2.10). A quota is a guaranteed share of the
feed, not a ranking bias (D25). Read next is unchanged.

## Request and response

- The request gains an optional `seed`: an integer in [0, 2^32 - 1], both modes.
  This supersedes D9.
- Without a `seed`, the engine draws one at random. Every response carries the
  seed it used as `meta.seed`, so any response can be reproduced by sending it back
  (D26).
- `slotType` becomes `"ranked" | "quota" | "surprise" | "pin"`.

## Randomness

`createRng` (mulberry32) moves from `src/data/seed.ts` to `src/engine/rng.ts`;
the seed generator imports it from there. The engine builds one generator per
request from the seed. Only the exploration sample draws from it.

## Config

The feed profile gains pool size `exploration` and an optional `quotas` block:

```json
"quotas": { "enabled": false, "topics": {}, "follows": { "communities": 0.4, "publishers": 0.4 }, "surprise": 0.2 }
```

- `topics` maps a topic name to a share. Editors set it: it guarantees that share
  of every feed to articles on that topic, whatever the user's interests (D27).
- Every share lies in [0, 1]. All shares together, featured topics included, may
  not exceed 1. Unknown keys are rejected (D6). Any violation stops the server at
  startup.
- A missing `quotas` block means quotas are off.
- Read next accepts no `quotas` block, or `{ "enabled": false }` only. Reserved
  slots are feed only, as pins are (D3).
- `config/default.json` uses the work order's values with `enabled: false` and
  `exploration: 60`, so the default feed does not change.

## Exploration pool

- New repository query `unmatched(filter, topics, publishers, communities, n)`:
  articles passing the filter that share no topic in `topics`, are not from a
  publisher in `publishers` and share no community in `communities`; newest first.
  The filter applies before the limit, as for every pool. The repository stays
  free of randomness.
- `feedPools` asks it for the newest `pools.recent` such articles (the recent
  window) and samples `pools.exploration` of them with the request generator
  (partial Fisher-Yates). The sample is pool `exploration`.
- `topics` here are the user's interests above 0 (as for the topics pool, D20).
  A user with no interests and no follows gets a sample of recent articles: the
  cold-start exploration the work order asks for.
- The pool gets size 0, and no query, unless quotas are enabled and `surprise` is
  above 0 (D29). Without surprise slots its articles would almost never show (D18),
  and this keeps the default feed deterministic.

## Quota assembly

New module `src/engine/assembly/quotas.ts`. `assemble` runs it before the normal
fill when quotas are enabled.

1. `slots` = `limit` minus the pins placed.
2. Buckets, filled in this fixed order (D30):
   1. each featured topic, alphabetically: articles whose topics include it;
   2. `follows.publishers`: `followMatch` gives `"publisher"`;
   3. `follows.communities`: `followMatch` gives `"community"`;
   4. `surprise`: candidates whose `sourcePools` include `exploration`.
   `followMatch` already lets a followed publisher win over a community (D21).
3. Target per bucket = `round(share × slots)`, capped at the slots still free.
   Over-booking from rounding therefore shortens the later buckets (D30).
4. Each bucket takes its members by final score (`compareScored`), skipping
   articles already reserved: an article counts for one bucket at most.
5. A bucket with too few members leaves its remaining slots to the normal fill.
   Never fail.
6. The normal fill takes the global ranking, skipping reserved articles.
7. One publisher count spans steps 4 and 6, so `maxPerPublisher` holds over the
   whole list. `capPerPublisher` is generalised to share that count; the rule
   stays in `diversity.ts`.
8. Order is unchanged: all non-pin items by final score, then pins at their slots.
   Reserved items are not moved up (D28).

Bucket membership and filling stay in assembly. Scoring does not change.

## Output and explanations

- Featured-topic and follows bucket items: `slotType: "quota"`. Surprise bucket
  items: `slotType: "surprise"`. Fill items stay `"ranked"`. All three keep
  `finalScore`, `breakdown` and `sourcePools`.
- Surprise items: `reasons = ["Something outside your usual topics"]`.
- Featured-topic items: "Featured topic: {topic}" first, then the usual criterion
  reasons, at most two reasons in total. The topic name comes from config, not from
  the request.
- Follows bucket items keep the usual reasons, which already name the follow.
- Both new texts go into `reasonTemplates` in `src/engine/explain.ts`.

## Records

- README: the `seed` field and `meta.seed`, the `exploration` pool, the `quotas`
  block, the new slot types and reasons; drop the "no quotas yet" limitation.
- D25 to D30 in `DECISIONS.md`.

## Testing

Test first, as before.

- rng: same seed, same sequence; the seed generator still yields the same seed data.
- config: shares above 1 in total rejected; a share outside [0, 1] rejected;
  unknown quota key rejected; read next with `enabled: true` rejected; a missing
  `quotas` block means off.
- `unmatched` in memory: leaves out topic, publisher and community matches; filter
  before limit; newest first.
- exploration pool: the same seed gives the same sample, another seed usually a
  different one; size 0 and no repository call when quotas are off or
  `surprise` is 0; a cold-start user gets a sample of recent articles.
- quotas: shares met when members suffice; shortfall goes to the fill; an article
  in two buckets counts once and lands in the earlier one; over-booked rounding is
  capped; the publisher cap holds across quota and fill; `enabled: false` gives
  the same output as before.
- explain: the two new reason texts; surprise items carry only the surprise reason.
- end to end: `meta.seed` echoed; a sent seed gives an identical response twice;
  no seed still gives a valid response; with quotas on, surprise and quota items
  carry their `slotType` and reasons; the existing tests pass unchanged on the
  default config.
- scale: seeded users with quotas enabled; the 100 ms smoke test still passes.

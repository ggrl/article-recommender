# Phase 2a design: topics and follows

The spec is `display-europe-recommender-prototype.md` (the work order). This note
covers only what the work order leaves open for phase 2a. Rulings live in
`DECISIONS.md`; "D19" here means entry 19 there. Phase 1 design:
`2026-10-05-phase-1-design.md`.

## Scope

Phase 2 is split (D18). 2a adds the topics and follows criteria (work order 2.8),
the `follows` and `topics` feed pools (2.7), their config keys and their reasons
(2.10). The exploration pool, surprise slots and quota assembly are 2b, designed
once the quota semantics are settled. Read next is unchanged.

## Criteria

Both are modules in `src/engine/scoring/`, registered in `criteria` like the phase 1
criteria, so they run only when their weight is above 0.

**`topics.ts`** (D19, D20):

- `maxInterest` = the highest value in `user.topicInterests`. Interests of 0 count as
  no interest.
- score = `min(1, Σ topicInterests[t] for each distinct t in article.topics /
  maxInterest)`; 0 when the user has no interest above 0 or the article has no
  matching topic.
- detail = the matching topic with the highest interest; on a tie, the
  alphabetically first. A score of 0 carries no detail.

**`follows.ts`** (D21):

- score = 1 if `article.publisherId` is in `user.followedPublishers` or one of
  `article.communityIds` is in `user.followedCommunities`, else 0.
- detail = `"publisher"` when the publisher matches (it wins over a community
  match), `"community"` when only a community matches. A score of 0 carries no
  detail.

**Context.** `ScoringContext` gains `user: UserContext`. Nothing else in scoring
changes.

## Details on breakdown entries (D22)

The reason "Matches your interest in {topic}" needs the matched topic, and the
breakdown carries only numbers today. A criterion's score map may now hold either
a number or `{ score: number; detail: string }`:

```ts
export type CriterionScore = number | { score: number; detail: string };
export interface Criterion {
  id: string;
  score(candidates: Article[], ctx: ScoringContext): Map<ArticleId, CriterionScore>;
}
```

`scoreCandidates` copies `detail` into the item's `BreakdownEntry`
(`{ score; weight; contribution; detail? }`). The phase 1 criteria keep returning
plain numbers and do not change. `detail` is visible in the API response.

## Pools

Two repository queries, both taking the `CandidateFilter`, applying it before the
size limit, and returning newest first:

- `follows(filter, publishers, communities, n)`: articles from a followed publisher
  or a followed community.
- `topics(filter, topics, n)`: articles sharing at least one topic the user has an
  interest above 0 in.

`feedPools` adds them as pools `follows` and `topics`. When the user follows
nothing, or has no interest above 0, that pool returns nothing without calling the
repository (cold start).

## Config

The feed profile schema accepts weights `topics` and `follows` and pool sizes
`follows` and `topics`. `config/default.json` uses the work order's values: weights
0.8 and 0.8, pools 100 and 100. Read next accepts neither. `quotas` is still an
unknown key (D6) until 2b.

## Explanations

Added to the keyed templates in `src/engine/explain.ts`:

- topics: "Matches your interest in {topic}"
- follows: "From a publisher you follow" / "From a community you follow" (D21)

## Records

- README: the feed profile's accepted keys, the new reasons, and `detail` on
  breakdown entries.
- D23: from 2a on, `followedPublishers`, `followedCommunities` and `topicInterests`
  are read by the engine, so D17's unbounded-array limit covers them too.

## Testing

Test first, as in phase 1.

- topics: no interests gives 0; the strongest interest gives 1; two weaker
  interests add up and clamp at 1; an article without topics gives 0; an interest
  of 0 is ignored; the tie-break picks the alphabetically first topic.
- follows: publisher gives 1 with `"publisher"`, community gives 1 with
  `"community"`, both give `"publisher"`, neither gives 0.
- registry: `detail` reaches the breakdown; a plain-number criterion has none.
- pools: in-memory `follows` and `topics` apply the filter before the limit and
  return newest first; no repository call for a user without follows or interests.
- explain: the three new reason texts.
- end to end: a user following a publisher sees its articles above unrelated
  articles of similar age with "From a publisher you follow"; weight 0 removes a
  criterion from score and reasons; the cold-start user still gets a full feed;
  identical requests give identical output; the 100 ms smoke test still passes.

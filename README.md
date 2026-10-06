# article-recommender

Prototype recommendation engine for a multilingual, non-profit European news
platform. One explainable engine serves the personalised feed and "read next"
suggestions. It runs on synthetic seed data; there is no real client data here.

How it works, as a diagram: `docs/how-it-works.md`.

The work order is `display-europe-recommender-prototype.md`, the design notes
(phases 1, 2a and 2b) are in `docs/superpowers/specs/`, and settled rulings are
in `DECISIONS.md`.

## Setup

Needs Node.js 22.23 or newer (it runs the TypeScript sources directly).

```bash
npm install
npm run verify   # type check, lint, tests
npm start        # demo on http://127.0.0.1:3000 (PORT to change)
```

## Demo endpoints

- `GET /health`
- `POST /recommend` with `{ mode, user, limit, now?, anchorArticleId?, seed? }`.
  `mode` is `feed` or `readNext`; `readNext` needs `anchorArticleId`. `now` is an
  ISO date and defaults to the server clock. `limit` is 1 to 100. `seed` is an
  integer from 0 to 4294967295; without one the engine draws one. `meta.seed` in
  the response is the seed used, so sending it back reproduces the response.

```bash
curl -s -X POST http://127.0.0.1:3000/recommend -H 'content-type: application/json' \
  -d '{"mode":"feed","limit":5,"user":{"language":"en","fallbackLanguages":[],"topicInterests":{},"followedCommunities":[],"followedPublishers":[],"readArticleIds":[]}}'
```

The demo generates its seed data against the server clock at start-up, so a `now`
far from start-up time gives odd results: articles dated after `now` count as
brand new, and pins and read windows shift.

Every item has a `slotType`: `ranked`, `quota`, `surprise` or `pin`. A scored
item (all but pins) carries `breakdown` (score, weight and contribution per
criterion), `sourcePools` and human-readable `reasons`. A surprise item's only
reason is "Something outside your usual topics"; a featured-topic quota item's
first reason is "Featured topic: {topic}". A pin item carries the editor's note
as `reasons` and `pinNote`, `finalScore: null`, and an empty `breakdown` and
`sourcePools`. The `topics` and `follows` entries also carry `detail` when they
matched: for `topics` it is the strongest matched topic, for `follows` it is
`publisher` or `community`.

## Configuration

`config/default.json` holds a `feed` and a `readNext` profile: maximum article age,
pool sizes, criterion weights, recency half-life, popularity window and the
per-publisher cap. A weight of 0 or a missing weight switches a criterion off.
The `feed` profile accepts the weight keys `recency`, `popularity`, `topics`
and `follows`, and the pools `recent`, `popular`, `follows`, `topics` and
`exploration`; the `readNext` profile accepts `similarity`, `recency` and
`popularity`. Any other weight key is a startup error, and an invalid config
stops the server at startup.

The `feed` profile's `quotas` block reserves shares of the feed (`DECISIONS.md`
entries 25 to 30). It is off by default:

- `enabled`: switches all quotas on or off.
- `topics`: featured topics set by editors, topic name to share, for example
  `{ "climate": 0.1 }`, whatever the user's interests. A share is filled only from the candidates the pools found, so a topic with no recent, popular or matching articles comes up short and its slots go to the normal fill.
- `follows.publishers`, `follows.communities`: shares for followed publishers
  and communities.
- `surprise`: the share for articles matching none of the user's topics or
  follows, sampled from the `exploration` pool. That pool is only queried when
  quotas are on and `surprise` is above 0.

Shares are fractions of the slots left after pins and may add up to 1 at most.
Reserved items keep their place by score, so low-scoring ones end up near the
end of the list.

## Adding a criterion

1. Create `src/engine/scoring/<name>.ts` exporting a `Criterion`: an `id` and
   `score(candidates, ctx)` returning a score in [0, 1] per article. A score
   may be `{ score, detail }` when the reason needs to name what matched.
2. Register it in `criteria` in `src/engine/scoring/index.ts`.
3. Add its weight key to the profile schema in `src/engine/config.ts`.
4. Add its weight to `config/default.json` to switch it on.
5. Add its reason text to `reasonTemplates` and `reasonText` in
   `src/engine/explain.ts`.

## Known limitations

- Reserved quota and surprise items are not moved up, so they mostly sit at the
  end of the feed (`DECISIONS.md` entry 28).
- Follow reasons do not name the publisher or community (entry 21).
- Similarity is topic-tag overlap; embeddings come later.
- In-memory storage only; the seed data is regenerated at every start.
- The demo is for local use only: it listens on 127.0.0.1, and request lists
  have no size limits (see `DECISIONS.md` entry 17 before exposing it).

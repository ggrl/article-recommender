# article-recommender

Prototype recommendation engine for a multilingual, non-profit European news
platform. One explainable engine serves the personalised feed and "read next"
suggestions. It runs on synthetic seed data; there is no real client data here.

The work order is `display-europe-recommender-prototype.md`, the phase 1 design is
in `docs/superpowers/specs/`, and settled rulings are in `DECISIONS.md`.

## Setup

Needs Node.js 22.23 or newer (it runs the TypeScript sources directly).

```bash
npm install
npm run verify   # type check, lint, tests
npm start        # demo on http://127.0.0.1:3000 (PORT to change)
```

## Demo endpoints

- `GET /health`
- `POST /recommend` with `{ mode, user, limit, now?, anchorArticleId? }`.
  `mode` is `feed` or `readNext`; `readNext` needs `anchorArticleId`. `now` is an
  ISO date and defaults to the server clock. `limit` is 1 to 100.

```bash
curl -s -X POST http://127.0.0.1:3000/recommend -H 'content-type: application/json' \
  -d '{"mode":"feed","limit":5,"user":{"language":"en","fallbackLanguages":[],"topicInterests":{},"followedCommunities":[],"followedPublishers":[],"readArticleIds":[]}}'
```

The demo generates its seed data against the server clock at start-up, so a `now`
far from start-up time gives odd results: articles dated after `now` count as
brand new, and pins and read windows shift.

A ranked item carries `breakdown` (score, weight and contribution per
criterion), `sourcePools` and human-readable `reasons`. A pin item carries the
editor's note as `reasons` and `pinNote`, `finalScore: null`, and an empty
`breakdown` and `sourcePools`.

## Configuration

`config/default.json` holds a `feed` and a `readNext` profile: maximum article age,
pool sizes, criterion weights, recency half-life, popularity window and the
per-publisher cap. A weight of 0 or a missing weight switches a criterion off.
The `feed` profile accepts the weight keys `recency` and `popularity`; the
`readNext` profile accepts `similarity`, `recency` and `popularity`. Any other
weight key is a startup error, and an invalid config stops the server at
startup.

## Adding a criterion

1. Create `src/engine/scoring/<name>.ts` exporting a `Criterion`: an `id` and
   `score(candidates, ctx)` returning a score in [0, 1] per article.
2. Register it in `criteria` in `src/engine/scoring/index.ts`.
3. Add its weight key to the profile schema in `src/engine/config.ts`.
4. Add its weight to `config/default.json` to switch it on.
5. Add its reason text to `reasonTemplates` and `reasonText` in
   `src/engine/explain.ts`.

## Known limitations

- Phase 1 only: no topics, follows, quotas, exploration or surprise slots yet.
- Similarity is topic-tag overlap; embeddings come later.
- In-memory storage only; the seed data is regenerated at every start.
- Pins ignore every filter except language, as the work order asks, so a
  pinned article that was later withdrawn, embargoed, already read by the
  user, or older than the profile's maxAgeDays is still shown until the pin
  expires.

# Demo GUI design: a page that shows the engine working

A local web page for trying the feed with different weights and quotas. It is a
demo tool, not part of the work order. Rulings live in `DECISIONS.md`; "D31" here
means entry 31 there. How the engine works: `docs/how-it-works.md`.

## Scope

- One page, served by the existing demo server at `http://127.0.0.1:3000/`, local
  only (D31).
- Feed only. The user picks one of the five seed readers and sets the feed weights
  and quotas; the page shows the resulting feed. No editing of reader details, no
  read next view.
- The engine does not change. All new code lives in `src/http` and the page file.

## The page

One screen: settings on the left, the feed on the right; stacked on a narrow window.

**Settings:**

- **Reader:** a dropdown of the five seed readers ("Anonymous (cold start)", then
  u1 to u4 by `userId`), with a one-line summary of the chosen reader's languages,
  interests and follows.
- **Weights:** four sliders, 0 to 2 in steps of 0.1, value shown: freshness
  (`recency`), popularity, interest match (`topics`), follows. At least one must
  stay above 0 (existing config rule, D6).
- **Quotas:** an on/off switch; sliders 0 to 1 in steps of 0.05 for followed
  publishers, followed communities and surprise; featured topics as the list of seed
  topics, each with a share input (0 means not featured, and is left out of the
  posted `topics` map). A running total of all shares, red above 1.
- **Seed:** a number field and a "New seed" button that draws a random seed.
- **Reset to defaults:** restores the values from `GET /demo/options`.

**Feed (20 articles):** per row the rank, a slot chip (`ranked`, `quota`,
`surprise`, `pin`), the article ID, publisher, topics and age in hours or days
(seed articles have no titles), the reasons, the final score, and a stacked bar of
each criterion's contribution. Pin rows show the editor's note instead of a score.

**Behaviour:** the feed refreshes about 200 ms after the last change; no Apply
button. If the server answers with an error, the message appears above the feed and
the last good feed stays visible. On first load the page fetches
`GET /demo/options`, fills the controls with the defaults and the first reader,
draws a random seed and shows that feed.

**Look:** the palette of the published how-it-works page, light and dark through
`prefers-color-scheme`, and system font stacks only: the page loads nothing from
outside the demo server (D31).

**Rendering rule:** everything received from the server goes into the page with
`textContent` and created elements, never `innerHTML`. Reason texts can carry
featured-topic names from the request, and error messages echo input.

## Server side

New module `src/http/demo.ts`:

```ts
export interface DemoDeps {
  repository: Repository;
  rawConfig: unknown;      // config/default.json as parsed JSON, before validation
  users: UserContext[];    // the seed readers
  topics: string[];        // sorted, unique, from the seed articles
  now: () => Date;         // main.ts passes () => new Date(); tests pass a fixed date
}
export function registerDemo(app: FastifyInstance, deps: DemoDeps): void;
```

Routes:

- `GET /` serves `src/http/demo.html` with `content-type: text/html`. The file is
  read once, when `registerDemo` runs.
- `GET /demo/options` returns
  `{ readers: { label, user }[], topics, defaults: { weights, quotas } }`. `label` is
  "Anonymous (cold start)" for a reader without `userId`, otherwise the `userId`.
  `defaults` is the feed profile's `weights` and `quotas` from `rawConfig`.
- `POST /demo/feed` with `{ reader, seed?, weights, quotas }`:
  1. The body passes a strict schema that checks only its outer shape: `reader` is
     an integer index into `users`, `seed` is passed through, `weights` and
     `quotas` are any value. Failure: 400 with the validation message.
  2. A copy of the default config with the feed profile's `weights` and `quotas`
     replaced by the posted ones; the default itself is never changed.
  3. `parseConfig` checks the result: ranges, unknown keys, at least one weight on,
     shares at most 1. Failure: 400 with its message. The value rules therefore stay
     in `src/engine/config.ts` only.
  4. `createRecommender({ repository, config })` builds an engine for this request.
  5. `recommend({ mode: "feed", user: users[reader], limit: 20, now: now(), seed })`.
     A `RequestError` (for example a bad seed) becomes 400.
  6. The engine's response is returned unchanged, plus one extra field the page
     needs because items carry only article IDs: `articles`, keyed by the returned
     article IDs, each `{ publisherId, topics, ageHours }`, with `ageHours` counted
     from the same `now` the engine used and rounded to whole hours.

`src/http/main.ts` already reads the config and generates the seed data; it also
derives the topic list from the seed articles and calls `registerDemo`.
`buildServer` and `POST /recommend` do not change.

## Records

- D31 in `DECISIONS.md`: the demo routes accept a whole feed config from the
  request and stay local only, under D17.
- README: how to open the page, under "Demo endpoints".

## Testing

Test first, in `test/demo.test.ts`, with Fastify's `inject` on a server built the
way `main.ts` builds it, seed data from `generateSeed(42, NOW)` and `now` fixed to
`NOW`.

- `GET /` answers 200 with an HTML content type.
- `GET /demo/options`: five readers, the first labelled "Anonymous (cold start)";
  topics sorted and unique; defaults equal the feed weights and quotas of the
  default config.
- `POST /demo/feed` with the default weights and quotas and seed 7 returns, apart
  from `articles`, exactly what `POST /recommend` returns for the same reader, `now`
  and seed; `articles` has one entry per returned item.
- Popularity weight 0: no item's breakdown has `popularity`.
- Quotas enabled with surprise 0.2: at least one item has `slotType` `surprise`
  (cold-start reader).
- 400 for: shares adding up to more than 1; all weights 0; an unknown weight key;
  `reader` 5 or -1; an unknown body key.

The page's own behaviour has no automated test; the repository has no browser test
setup and adding one is out of proportion for a demo page. It is checked by hand:
start the server, open the page, change a weight, switch quotas on, push the shares
above 1 and confirm the error and the kept feed. Then the ux-reviewer agent walks it.

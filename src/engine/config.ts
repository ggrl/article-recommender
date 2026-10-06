import { z } from "zod";

const weight = z.number().min(0).optional();
const poolSize = z.number().int().min(0);
const recency = z.strictObject({ halfLifeHours: z.number().positive() });
const popularity = z.strictObject({
  windowDays: z.number().int().positive(),
  normalisePerPublisher: z.boolean(),
});
const diversity = z.strictObject({ maxPerPublisher: z.number().int().positive() });

const share = z.number().min(0).max(1);
// Shares are decimal fractions: 0.2 + 0.4 + 0.3 + 0.1 sums to just above 1 in floating point.
const SHARE_TOLERANCE = 1e-9;
const quotas = z
  .strictObject({
    enabled: z.boolean(),
    topics: z.record(z.string().min(1), share),
    follows: z.strictObject({ communities: share, publishers: share }),
    surprise: share,
  })
  .refine(
    (q) =>
      Object.values(q.topics).reduce((sum, s) => sum + s, 0) + q.follows.communities + q.follows.publishers + q.surprise <=
      1 + SHARE_TOLERANCE,
    "quota shares may not add up to more than 1",
  );

// A missing or zero weight means the criterion is off (work order 2.6); D6 requires one left on.
const someWeightOn = (weights: Record<string, number | undefined>) =>
  Object.values(weights).some((w) => w !== undefined && w > 0);
const allOff = "at least one weight must be above 0";

const feedProfileSchema = z.strictObject({
  maxAgeDays: z.number().int().positive(),
  pools: z.strictObject({ recent: poolSize, popular: poolSize, follows: poolSize, topics: poolSize, exploration: poolSize }),
  weights: z
    .strictObject({ recency: weight, popularity: weight, topics: weight, follows: weight })
    .refine(someWeightOn, allOff),
  recency,
  popularity,
  diversity,
  quotas: quotas.optional(),
});

const readNextProfileSchema = z.strictObject({
  maxAgeDays: z.number().int().positive(),
  pools: z.strictObject({ similar: poolSize, sameSource: poolSize, popular: poolSize }),
  weights: z
    .strictObject({ similarity: weight, recency: weight, popularity: weight })
    .refine(someWeightOn, allOff),
  recency,
  popularity,
  diversity,
  // Reserved slots are feed only, as pins are (D3).
  quotas: z.strictObject({ enabled: z.literal(false) }).optional(),
});

const configSchema = z.strictObject({
  version: z.string().min(1),
  profiles: z.strictObject({ feed: feedProfileSchema, readNext: readNextProfileSchema }),
});

export type Config = z.infer<typeof configSchema>;
export type FeedProfile = Config["profiles"]["feed"];
export type ReadNextProfile = Config["profiles"]["readNext"];
export type Profile = FeedProfile | ReadNextProfile;

export type Quotas = NonNullable<FeedProfile["quotas"]>;

/** The feed's quotas when switched on; a missing block means off. */
export function activeQuotas(profile: FeedProfile): Quotas | undefined {
  return profile.quotas?.enabled === true ? profile.quotas : undefined;
}

export function parseConfig(raw: unknown): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success) throw new Error(`Invalid config:\n${z.prettifyError(result.error)}`);
  return result.data;
}

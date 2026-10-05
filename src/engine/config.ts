import { z } from "zod";

const weight = z.number().min(0).optional();
const poolSize = z.number().int().min(0);
const recency = z.strictObject({ halfLifeHours: z.number().positive() });
const popularity = z.strictObject({
  windowDays: z.number().int().positive(),
  normalisePerPublisher: z.boolean(),
});
const diversity = z.strictObject({ maxPerPublisher: z.number().int().positive() });

// A missing or zero weight means the criterion is off (work order 2.6); D6 requires one left on.
const someWeightOn = (weights: Record<string, number | undefined>) =>
  Object.values(weights).some((w) => w !== undefined && w > 0);
const allOff = "at least one weight must be above 0";

const feedProfileSchema = z.strictObject({
  maxAgeDays: z.number().int().positive(),
  pools: z.strictObject({ recent: poolSize, popular: poolSize }),
  weights: z.strictObject({ recency: weight, popularity: weight }).refine(someWeightOn, allOff),
  recency,
  popularity,
  diversity,
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
});

const configSchema = z.strictObject({
  version: z.string().min(1),
  profiles: z.strictObject({ feed: feedProfileSchema, readNext: readNextProfileSchema }),
});

export type Config = z.infer<typeof configSchema>;
export type FeedProfile = Config["profiles"]["feed"];
export type ReadNextProfile = Config["profiles"]["readNext"];
export type Profile = FeedProfile | ReadNextProfile;

export function parseConfig(raw: unknown): Config {
  const result = configSchema.safeParse(raw);
  if (!result.success) throw new Error(`Invalid config:\n${z.prettifyError(result.error)}`);
  return result.data;
}

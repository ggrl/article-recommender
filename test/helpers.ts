import { readFileSync } from "node:fs";
import { parseConfig, type Config } from "../src/engine/config.ts";

export function loadDefaultConfig(): Config {
  return parseConfig(JSON.parse(readFileSync(new URL("../config/default.json", import.meta.url), "utf8")));
}

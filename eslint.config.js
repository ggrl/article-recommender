import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  // .agents/ and .claude/ are gitignored agent-tooling assets, not project source; they are
  // not part of the tsconfig include and ship their own non-Node globals that this ruleset
  // was never meant to check.
  { ignores: [".agents/**", ".claude/**"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);

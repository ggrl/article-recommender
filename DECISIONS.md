# Decisions

Settled rulings. To change one, add a new entry that supersedes it; never edit an
old ruling silently.

## 1. npm as the package manager (2026-10-05)

- **Context:** the work order allowed "pnpm (or npm if simpler)". pnpm is not
  installed here; npm is, and the maintainer has used it before.
- **Decision:** npm. The verify command builds on `npm test`.
- **Alternatives considered:** pnpm via corepack. Nothing in the plan needs it.
- **Consequences:** `package-lock.json` is the committed lockfile.

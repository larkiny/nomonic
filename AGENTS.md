# Repository Guidelines

## Project Structure & Module Organization
`ts/` contains the TypeScript implementation: `detect.ts` is the core scanner, `check-staged.ts` is the CLI Husky runs, and `*.test.ts` files live beside their subjects for focused coverage. `wordlist.ts` exports the canonical Set of 2048 words. `bash/check-bip39-seeds.sh` mirrors the detector for repos without Node tooling. `setup.sh` is the curlable entry point, so keep it idempotent, dependency-light, and safe to re-run.

## Build, Test, and Development Commands
Install deps with the package manager your consumer repo uses (`pnpm install`, `npm install`, `yarn install`, or `bun install`). Run all checks via `pnpm vitest run ts`; target a single file with `pnpm vitest run ts/detect.test.ts` while iterating. Exercise the CLI exactly like the hook with `pnpm exec tsx ts/check-staged.ts --files path/to/diff`, which mirrors `npx tsx scripts/bip39/check-staged.ts` downstream. Validate the Bash flow with `bash bash/check-bip39-seeds.sh path/to/file`.

## Coding Style & Naming Conventions
Stick to 2-space indentation, single quotes, and no semicolons in TypeScript to match existing diffs. Favor `const`, pure helpers, and descriptive verbs (`stripToken`, `analyzeLine`, `detectBip39Sequences`). Mirror any CLI flag or output change in both TypeScript and Bash; the shell scripts stay snake_case, start with `#!/usr/bin/env bash`, and enable `set -euo pipefail`.

## Testing Guidelines
Vitest powers both algorithm and CLI checks—`detect.test.ts` governs token parsing while `check-staged.test.ts` guards staging behaviors. Every bug fix must land with a regression test that reproduces the offending mnemonic layout (comma-separated, numbered lines, Algorand grids, etc.). Name cases as behavior statements (`detects cross-line grids`, `rejects prose with apostrophes`) and run the suite before requesting review.

## Commit & Pull Request Guidelines
Follow the observed conventional-commit format (`feat: add cross-line detection`, `fix: prevent non-contiguous spans`). Keep subjects imperative, reference issue IDs in the body when relevant, and document mnemonic formats or config toggles changed. Include a short snippet of updated hook output plus `pnpm vitest run` logs (or CI links) so reviewers can verify coverage.

## Security & Configuration Tips
Never stage real seed phrases; assemble examples by shuffling safe words from `ts/wordlist.ts`. Document and test both the default threshold (5) and any `BIP39_THRESHOLD` overrides. Treat `setup.sh` as supply-chain sensitive: avoid fetching third-party binaries, keep downloads pinned to this repo, and ensure hook commands stay relative so downstream repos never execute unexpected code.

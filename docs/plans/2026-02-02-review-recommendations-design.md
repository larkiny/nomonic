# Review Recommendations Design

## Goal

Address code review recommendations by adding API documentation (TypeDoc + JSDoc), test coverage reporting (vitest coverage-v8), and performance benchmarks (vitest bench).

## 1. JSDoc + TypeDoc (API Documentation)

Add JSDoc comments to all exported functions/interfaces, then configure TypeDoc to generate HTML docs deployed to GitHub Pages.

### JSDoc scope

| File | Exports to document |
|------|---------------------|
| `ts/detect.ts` | `detectBip39Sequences(content, threshold)` |
| `ts/ignore.ts` | `loadIgnorePatterns(cwd)`, `compilePattern(pattern)`, `isIgnored(filePath, patterns)` |
| `ts/scan-repo.ts` | `scanFiles(files, threshold)`, `ScanViolation` interface |
| `ts/check-staged.ts` | `getStagedFiles()`, `main()` |
| `ts/wordlist.ts` | `BIP39_WORDLIST` constant |

### TypeDoc setup

- Install `typedoc` as devDependency
- Create `typedoc.json` with entry points for all 5 source files
- Output to `docs/` (gitignored)
- Add `"docs": "typedoc"` script to package.json

### CI deployment

- Add a `docs` job to `ci.yml` that builds docs on push to `main`
- Deploy to GitHub Pages using `actions/deploy-pages`
- Docs available at `larkiny.github.io/nomonic/`

## 2. Vitest Coverage

Add `@vitest/coverage-v8` and print coverage table in CI logs. No external service.

### Setup

- Install `@vitest/coverage-v8` as devDependency
- Add `"test": "vitest run ts"` and `"test:coverage": "vitest run ts --coverage"` scripts to package.json

### CI change

- Update the `test-ts` job to run `pnpm run test:coverage` instead of `pnpm vitest run ts`
- Coverage summary table prints inline in GitHub Actions log
- No minimum thresholds enforced in v1

## 3. Performance Benchmarks

Create a benchmark file using vitest's built-in `bench` API. Informational only in CI.

### Benchmark file: `ts/detect.bench.ts`

Two benchmarks targeting `detectBip39Sequences`:
1. **Small file** (~100 lines of normal English) — baseline for typical staged files
2. **Large file** (~10,000 lines with scattered BIP39 words) — stress test for full repo scans

### Setup

- No additional dependencies — vitest has `bench` built in
- Add `"bench": "vitest bench ts"` script to package.json

### CI

- Run `pnpm run bench` as an informational step (no hard failure threshold)
- vitest bench outputs a table with iterations, avg time, and p75/p99

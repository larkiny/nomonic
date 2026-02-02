# Review Recommendations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TypeDoc API docs (deployed to GitHub Pages), vitest coverage reporting in CI, and performance benchmarks.

**Architecture:** JSDoc comments on all exported functions/interfaces, TypeDoc generates HTML docs, GitHub Actions deploys to Pages on push to main. Coverage uses @vitest/coverage-v8 printing to CI logs. Benchmarks use vitest's built-in bench API as an informational CI step.

**Tech Stack:** TypeDoc, @vitest/coverage-v8, vitest bench, GitHub Pages via actions/deploy-pages

---

### Task 1: Create tsconfig.json and install TypeDoc

TypeDoc requires a tsconfig.json to resolve types. The project currently has none.

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json`

**Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true
  },
  "include": ["ts/**/*.ts"],
  "exclude": ["ts/**/*.test.ts", "ts/**/*.bench.ts"]
}
```

**Step 2: Install TypeDoc**

Run: `pnpm add -D typedoc`

**Step 3: Create typedoc.json**

```json
{
  "entryPoints": [
    "ts/detect.ts",
    "ts/ignore.ts",
    "ts/scan-repo.ts",
    "ts/check-staged.ts",
    "ts/wordlist.ts"
  ],
  "out": "docs-site",
  "tsconfig": "tsconfig.json",
  "name": "nomonic",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeInternal": true
}
```

Note: output to `docs-site/` (not `docs/`) since `docs/plans/` already exists for planning docs.

**Step 4: Add docs-site/ to .gitignore**

Create or update `.gitignore`:
```
docs-site/
```

**Step 5: Add docs script to package.json**

Add to `"scripts"`:
```json
"docs": "typedoc"
```

**Step 6: Verify TypeDoc builds**

Run: `pnpm run docs`
Expected: Generates HTML files in `docs-site/` without errors.

**Step 7: Commit**

```bash
git add tsconfig.json typedoc.json .gitignore package.json pnpm-lock.yaml
git commit -m "chore: add TypeDoc config and tsconfig.json"
```

---

### Task 2: Add JSDoc comments to all exported functions

Add `@param`, `@returns`, and `@example` JSDoc blocks to every exported function and interface. Some functions already have JSDoc (like `detectBip39Sequences` in `detect.ts`) — update those if needed, add to the rest.

**Files:**
- Modify: `ts/detect.ts`
- Modify: `ts/ignore.ts`
- Modify: `ts/scan-repo.ts`
- Modify: `ts/check-staged.ts`
- Modify: `ts/wordlist.ts`

**Step 1: Add JSDoc to `ts/detect.ts`**

`detectBip39Sequences` already has a detailed JSDoc. Add `@param` and `@returns` tags:

```typescript
/**
 * Detect sequences of consecutive BIP39 mnemonic words in text content.
 * Returns violations where `threshold` or more consecutive BIP39 words appear.
 *
 * Detection operates in two modes:
 * 1. **Single-line**: finds sequences of BIP39 words within a line (handles mixed content).
 * 2. **Cross-line**: accumulates words across consecutive "BIP39-pure" lines (where every
 *    non-skip token is a BIP39 word). Blank or whitespace-only lines are transparent and do
 *    not break the sequence. Catches one-per-line, numbered lists, formatted blocks, and grids.
 *
 * Tokens are stripped of surrounding punctuation (quotes, commas, brackets, etc.)
 * before matching. Interior punctuation (hyphens, apostrophes) still disqualifies a token.
 * Purely non-alphabetic tokens (like "1.", "2)", "//") are skipped without breaking a sequence.
 *
 * @param content - The text content to scan for BIP39 sequences
 * @param threshold - Minimum consecutive BIP39 words to trigger a violation (default: 5)
 * @returns Array of violations found, each with line number, matched words, and the source line
 *
 * @example
 * ```ts
 * const violations = detectBip39Sequences('abandon ability able about above absent', 5)
 * // Returns one violation with 6 matched words
 * ```
 */
```

Add JSDoc to `Bip39Violation` interface:

```typescript
/** A detected sequence of consecutive BIP39 mnemonic words in scanned content. */
export interface Bip39Violation {
  /** Line number (1-based) where the sequence was found */
  lineNumber: number
  /** The consecutive BIP39 words that triggered the violation */
  matchedWords: string[]
  /** The full source line where detection started */
  line: string
}
```

**Step 2: Add JSDoc to `ts/ignore.ts`**

```typescript
/**
 * Load ignore patterns from the `.nomonicignore` file in the given directory.
 * Returns an empty array if the file doesn't exist.
 * Lines starting with `#` are comments. Blank lines are skipped.
 *
 * @param cwd - Directory to look for `.nomonicignore` (default: `process.cwd()`)
 * @returns Array of glob pattern strings
 */
export function loadIgnorePatterns(cwd: string = process.cwd()): string[] {

/**
 * Compile a gitignore-style glob pattern into a RegExp.
 *
 * Supported syntax:
 * - `*` matches anything except `/`
 * - `**` matches any number of directories
 * - `?` matches a single non-slash character
 * - Leading `/` anchors the pattern to the repo root
 * - Trailing `/` matches directory contents
 *
 * @param pattern - A gitignore-style glob pattern
 * @returns A compiled RegExp that tests file paths against the pattern
 *
 * @example
 * ```ts
 * const pat = compilePattern('drizzle/migrations/**')
 * pat.test('drizzle/migrations/0001.sql') // true
 * ```
 */
export function compilePattern(pattern: string): RegExp {

/**
 * Test whether a file path matches any of the compiled ignore patterns.
 *
 * @param filePath - Relative file path to test (leading `./` is stripped automatically)
 * @param patterns - Array of compiled RegExp patterns from {@link compilePattern}
 * @returns `true` if the path matches any pattern and should be ignored
 */
export function isIgnored(filePath: string, patterns: RegExp[]): boolean {
```

**Step 3: Add JSDoc to `ts/scan-repo.ts`**

```typescript
/** A BIP39 violation detected in a specific file during a repository scan. */
export interface ScanViolation {
  /** Relative path to the file containing the violation */
  file: string
  /** Line number (1-based) where the sequence was found */
  lineNumber: number
  /** The consecutive BIP39 words that triggered the violation */
  matchedWords: string[]
  /** The full source line where detection started */
  line: string
}

/**
 * Scan a list of files for BIP39 seed phrase sequences.
 * Skips binary files (containing null bytes). Returns all violations found.
 *
 * @param files - Array of file paths to scan
 * @param threshold - Minimum consecutive BIP39 words to trigger a violation (default: 5)
 * @returns Array of violations with file path, line number, and matched words
 */
export function scanFiles(
```

**Step 4: Add JSDoc to `ts/check-staged.ts`**

```typescript
/** A line added in a git diff, with its file-level line number. */
export interface AddedLine {
  /** The line number in the actual file (1-based) */
  fileLineNumber: number
  /** The text content of the added line */
  text: string
}

/**
 * Extract added lines from a unified diff string.
 * Parses hunk headers to track line numbers accurately.
 *
 * @param diff - A unified diff string (output of `git diff`)
 * @returns Array of added lines with their file-level line numbers
 */
export function extractAddedLines(diff: string): AddedLine[] {

/** A block of content assembled from added lines, ready for BIP39 scanning. */
export interface ContentBlock {
  /** The assembled text content with sentinel lines between non-contiguous chunks */
  content: string
  /** Maps each content line index to its file line number (-1 for sentinel lines) */
  lineMap: number[]
}

/**
 * Build a content block from added lines, inserting empty sentinel lines
 * between non-contiguous lines so cross-line detection doesn't span gaps.
 *
 * @param addedLines - Array of added lines from {@link extractAddedLines}
 * @returns A content block with assembled text and a line number map
 */
export function buildContentBlock(addedLines: AddedLine[]): ContentBlock {
```

**Step 5: Add JSDoc to `ts/wordlist.ts`**

```typescript
/**
 * BIP39 English wordlist — all 2048 words used in cryptocurrency mnemonic seed phrases.
 *
 * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt}
 */
export const BIP39_WORDS: Set<string> = new Set(
```

Note: `wordlist.ts` already has a JSDoc comment. Update it to use `@see` tag for the link.

**Step 6: Rebuild docs and verify**

Run: `pnpm run docs`
Expected: HTML docs in `docs-site/` show all documented exports with param/returns/example blocks.

**Step 7: Run existing tests to ensure nothing broke**

Run: `pnpm vitest run ts`
Expected: All 77 tests pass (JSDoc comments don't affect behavior).

**Step 8: Run lint and format**

Run: `pnpm run lint && pnpm run format:check`
Expected: Clean. If Prettier reformats JSDoc, run `pnpm prettier --write ts/` first.

**Step 9: Commit**

```bash
git add ts/detect.ts ts/ignore.ts ts/scan-repo.ts ts/check-staged.ts ts/wordlist.ts
git commit -m "docs: add JSDoc comments to all exported functions and interfaces"
```

---

### Task 3: Add GitHub Pages deployment to CI

Add a `docs` job to `.github/workflows/ci.yml` that builds TypeDoc and deploys to GitHub Pages on push to main.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add the docs job**

Add this job after the existing jobs in `ci.yml`:

```yaml
  docs:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run docs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Or: check that the file is valid YAML.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add TypeDoc build and GitHub Pages deployment"
```

**Note:** After merging, you'll need to enable GitHub Pages in the repo settings (Settings → Pages → Source: GitHub Actions). This is a one-time manual step.

---

### Task 4: Add vitest coverage

Install `@vitest/coverage-v8`, add scripts, update CI.

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Install @vitest/coverage-v8**

Run: `pnpm add -D @vitest/coverage-v8`

**Step 2: Add test scripts to package.json**

Add to `"scripts"`:
```json
"test": "vitest run ts",
"test:coverage": "vitest run ts --coverage"
```

**Step 3: Update CI test-ts job**

In `.github/workflows/ci.yml`, change the `test-ts` job's last step:

From:
```yaml
      - run: pnpm vitest run ts
```

To:
```yaml
      - run: pnpm run test:coverage
```

**Step 4: Verify coverage runs locally**

Run: `pnpm run test:coverage`
Expected: All 77 tests pass, followed by a coverage summary table showing % coverage per file.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "ci: add vitest coverage reporting to test-ts job"
```

---

### Task 5: Add performance benchmarks

Create a benchmark file using vitest's built-in bench API. Add it to CI as an informational step.

**Files:**
- Create: `ts/detect.bench.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Create `ts/detect.bench.ts`**

```typescript
import { bench, describe } from 'vitest'
import { detectBip39Sequences } from './detect'

// Generate a block of normal English text (~100 lines)
function generateSmallFile(): string {
  const line =
    'The quick brown fox jumps over the lazy dog and runs through the meadow near the river'
  return Array(100).fill(line).join('\n')
}

// Generate a large file (~10,000 lines) with BIP39 words scattered every 500 lines
function generateLargeFile(): string {
  const normalLine =
    'The quick brown fox jumps over the lazy dog and runs through the meadow near the river'
  const seedLine =
    'abandon ability able about above absent absorb abstract absurd abuse access accident'
  const lines: string[] = []
  for (let i = 0; i < 10000; i++) {
    lines.push(i % 500 === 0 ? seedLine : normalLine)
  }
  return lines.join('\n')
}

const smallFile = generateSmallFile()
const largeFile = generateLargeFile()

describe('detectBip39Sequences', () => {
  bench('small file (100 lines, no seeds)', () => {
    detectBip39Sequences(smallFile, 5)
  })

  bench('large file (10k lines, scattered seeds)', () => {
    detectBip39Sequences(largeFile, 5)
  })
})
```

**Step 2: Add bench script to package.json**

Add to `"scripts"`:
```json
"bench": "vitest bench ts"
```

**Step 3: Verify benchmarks run locally**

Run: `pnpm run bench`
Expected: A table showing ops/sec, iterations, avg time, and p75/p99 for both benchmarks.

**Step 4: Add bench step to CI**

Add a new job to `.github/workflows/ci.yml`:

```yaml
  bench:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run bench
```

**Step 5: Commit**

```bash
git add ts/detect.bench.ts package.json .github/workflows/ci.yml
git commit -m "ci: add vitest performance benchmarks"
```

---

### Task 6: Final verification

Run all checks locally to confirm everything works together.

**Step 1: Run full test suite**

Run: `pnpm vitest run ts`
Expected: All 77 tests pass.

**Step 2: Run coverage**

Run: `pnpm run test:coverage`
Expected: Tests pass with coverage table.

**Step 3: Run benchmarks**

Run: `pnpm run bench`
Expected: Benchmark table with ops/sec for both scenarios.

**Step 4: Build docs**

Run: `pnpm run docs`
Expected: `docs-site/` generated with HTML docs.

**Step 5: Run lint and format**

Run: `pnpm run lint && pnpm run format:check`
Expected: Clean.

**Step 6: Review all changes**

Run: `git log --oneline` to verify commit history is clean.

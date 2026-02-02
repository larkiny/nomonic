# CI Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GitHub Actions CI pipeline with linting, TypeScript tests, bash smoke tests, and install smoke tests.

**Architecture:** Four parallel jobs in a single workflow file. Lint and test-ts require Node/pnpm. Test-bash uses `scan-repo.sh --dir` against temp files. Test-install runs `setup.sh` in isolated temp directories with a local file server override.

**Tech Stack:** GitHub Actions, ESLint (typescript-eslint flat config), Prettier, Vitest, Bash

---

### Task 1: Add Prettier config

**Files:**
- Create: `.prettierrc`

**Step 1: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "semi": false,
  "tabWidth": 2
}
```

**Step 2: Commit**

```bash
git add .prettierrc
git commit -m "chore: add Prettier config"
```

---

### Task 2: Add ESLint config

**Files:**
- Create: `eslint.config.js`

**Step 1: Create `eslint.config.js`**

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ['ts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['node_modules/', 'docs/', '**/*.test.ts'],
  },
)
```

**Step 2: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add ESLint config with typescript-eslint"
```

---

### Task 3: Install devDependencies and add scripts

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

```bash
pnpm add -D eslint typescript-eslint prettier
```

**Step 2: Add scripts to `package.json`**

Add these scripts to the existing `package.json`:

```json
{
  "scripts": {
    "lint": "eslint ts/",
    "format:check": "prettier --check ts/"
  }
}
```

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add eslint, prettier devDeps and lint scripts"
```

---

### Task 4: Fix existing lint and format violations

**Step 1: Run Prettier and fix**

```bash
pnpm prettier --write ts/
```

**Step 2: Run ESLint and fix**

```bash
pnpm eslint ts/ --fix
```

**Step 3: Run checks to verify clean**

```bash
pnpm run format:check
pnpm run lint
```

Expected: Both exit 0 with no errors.

**Step 4: Run existing tests to verify nothing broke**

```bash
pnpm vitest run ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add ts/
git commit -m "style: fix existing lint and format violations"
```

---

### Task 5: Create CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run format:check

  test-ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run ts

  test-bash:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: "Positive: space-separated phrase"
        run: |
          TMPDIR=$(mktemp -d)
          echo "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" > "$TMPDIR/seed.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR" && exit 1 || test $? -eq 1

      - name: "Positive: comma-separated phrase"
        run: |
          TMPDIR=$(mktemp -d)
          echo "abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, abandon, about" > "$TMPDIR/seed.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR" && exit 1 || test $? -eq 1

      - name: "Positive: numbered list"
        run: |
          TMPDIR=$(mktemp -d)
          printf '1. abandon\n2. abandon\n3. abandon\n4. abandon\n5. abandon\n6. abandon\n7. abandon\n8. abandon\n9. abandon\n10. abandon\n11. abandon\n12. about\n' > "$TMPDIR/seed.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR" && exit 1 || test $? -eq 1

      - name: "Positive: bulleted list"
        run: |
          TMPDIR=$(mktemp -d)
          printf -- '- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- abandon\n- about\n' > "$TMPDIR/seed.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR" && exit 1 || test $? -eq 1

      - name: "Positive: one word per line"
        run: |
          TMPDIR=$(mktemp -d)
          printf 'abandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabout\n' > "$TMPDIR/seed.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR" && exit 1 || test $? -eq 1

      - name: "Negative: clean English text"
        run: |
          TMPDIR=$(mktemp -d)
          echo "The quick brown fox jumps over the lazy dog. This is a perfectly normal sentence." > "$TMPDIR/clean.txt"
          bash bash/scan-repo.sh --dir "$TMPDIR"

  test-install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: "Install smoke test: Node project"
        run: |
          TMPDIR=$(mktemp -d)
          cd "$TMPDIR"
          git init
          echo '{"private":true}' > package.json
          npm install --save-dev tsx

          # Serve local files instead of fetching from GitHub
          REPO_ROOT="${GITHUB_WORKSPACE}"
          export REPO_RAW="file://${REPO_ROOT}"
          bash "${REPO_ROOT}/setup.sh"

          # Assertions
          test -f scripts/nomonic/wordlist.ts
          test -f scripts/nomonic/detect.ts
          test -f scripts/nomonic/check-staged.ts
          grep -q "scripts/nomonic/check-staged.ts" .husky/pre-commit

      - name: "Install smoke test: non-Node project"
        run: |
          TMPDIR=$(mktemp -d)
          cd "$TMPDIR"
          git init

          # Serve local files instead of fetching from GitHub
          REPO_ROOT="${GITHUB_WORKSPACE}"
          export REPO_RAW="file://${REPO_ROOT}"
          bash "${REPO_ROOT}/setup.sh"

          # Assertions
          test -f scripts/nomonic/check-bip39-seeds.sh
          test -x scripts/nomonic/check-bip39-seeds.sh
          grep -q "scripts/nomonic/check-bip39-seeds.sh" .git/hooks/pre-commit
```

Note on `REPO_RAW` override: `setup.sh` uses `$REPO_RAW` to build download URLs. By exporting `REPO_RAW=file:///path/to/checkout`, the `curl -fsSL` in the download helper will read from the local filesystem. Verify that `curl` supports `file://` on the CI runner (it does on ubuntu-latest).

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI pipeline with lint, test, bash smoke, and install smoke jobs"
```

---

### Task 6: Verify locally

**Step 1: Run all checks locally**

```bash
pnpm run lint
pnpm run format:check
pnpm vitest run ts
```

All should pass.

**Step 2: Test bash smoke test locally**

```bash
TMPDIR=$(mktemp -d)
echo "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" > "$TMPDIR/seed.txt"
bash bash/scan-repo.sh --dir "$TMPDIR"
echo "Exit code: $?"
```

Expected: exit code 1 (detection).

```bash
TMPDIR=$(mktemp -d)
echo "The quick brown fox jumps over the lazy dog." > "$TMPDIR/clean.txt"
bash bash/scan-repo.sh --dir "$TMPDIR"
echo "Exit code: $?"
```

Expected: exit code 0 (clean).

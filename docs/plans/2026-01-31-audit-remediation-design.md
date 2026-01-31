# Audit Remediation: Blank-Line Tolerance, Annotation Tokens, Full Repo Scan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close three detection gaps identified by audit: blank-line cross-line breaks, annotated-line purity resets, and staged-diff-only scope.

**Architecture:** Extend the existing two-pass detector with (1) blank-line transparency in cross-line accumulation, (2) an annotation-token allowlist that treats common seed-labeling words as SKIP tokens, and (3) a new `scan-repo` CLI for full-repository scanning. All changes maintain TypeScript/Bash parity.

**Tech Stack:** TypeScript (vitest), Bash 3.2+, git

---

### Task 1: Install Dependencies

**Files:** None (project setup)

**Step 1: Install npm dependencies**

Run: `pnpm install`

**Step 2: Verify test runner works**

Run: `pnpm vitest run ts/detect.test.ts`
Expected: All existing tests PASS

**Step 3: Commit (skip — no file changes)**

---

### Task 2: Blank-Line Tolerance — Failing Tests

**Files:**
- Modify: `ts/detect.test.ts:312-323` (update existing test)
- Modify: `ts/detect.test.ts` (add new test after line 323)

**Step 1: Update the "stops at empty lines" test to expect detection**

Change the test at line 312 from expecting no violations to expecting a violation. The 5 BIP39 words separated by a blank line should now be detected:

```typescript
  it('cross-line detection treats blank lines as transparent', () => {
    const content = [
      'abandon',
      'ability',
      'able',
      '',
      'about',
      'above',
    ].join('\n')
    const result = detectBip39Sequences(content)
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toEqual([
      'abandon', 'ability', 'able', 'about', 'above',
    ])
    expect(result[0].lineNumber).toBe(1)
  })
```

**Step 2: Add test for 12-word phrase in 4-word blocks separated by blank lines**

Add after the updated test:

```typescript
  it('detects 12-word seed phrase formatted as 4-word blocks with blank spacers', () => {
    const content = [
      'abandon abandon abandon abandon',
      '',
      'abandon abandon abandon abandon',
      '',
      'abandon abandon abandon about',
    ].join('\n')
    const result = detectBip39Sequences(content)
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toHaveLength(12)
  })
```

**Step 3: Add test for whitespace-only lines (tabs, spaces)**

```typescript
  it('cross-line detection treats whitespace-only lines as transparent', () => {
    const content = [
      'abandon',
      'ability',
      '   ',
      'able',
      '\t',
      'about',
      'above',
    ].join('\n')
    const result = detectBip39Sequences(content)
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toHaveLength(5)
  })
```

**Step 4: Run tests to verify they fail**

Run: `pnpm vitest run ts/detect.test.ts`
Expected: 3 FAIL (the new/updated tests), all others PASS

---

### Task 3: Blank-Line Tolerance — Implementation in detect.ts

**Files:**
- Modify: `ts/detect.ts:157-171` (cross-line loop)

**Step 1: Add blank-line skip in the cross-line loop**

In `detectBip39Sequences`, in the Pass 2 loop (line 157), add a blank-line check right after the `reportedLines` check and before the `analyzeLine` call. The loop body at lines 157-172 becomes:

```typescript
  for (let i = 0; i < lines.length; i++) {
    // Skip lines already fully reported by single-line detection
    if (reportedLines.has(i)) {
      flushCrossLine()
      continue
    }

    // Blank/whitespace-only lines are transparent — skip without flushing
    if (lines[i].trim().length === 0) continue

    const { bip39Words, isBip39Pure } = analyzeLine(lines[i])

    if (isBip39Pure && bip39Words.length > 0) {
      if (crossLineStart === -1) crossLineStart = i
      crossLineWords.push(...bip39Words)
    } else {
      flushCrossLine()
    }
  }
```

The only change is adding `if (lines[i].trim().length === 0) continue` before `analyzeLine`.

**Step 2: Run tests to verify they pass**

Run: `pnpm vitest run ts/detect.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add ts/detect.ts ts/detect.test.ts
git commit -m "feat: treat blank lines as transparent in cross-line detection"
```

---

### Task 4: Sentinel Fix — Failing Test

**Files:**
- Modify: `ts/check-staged.test.ts:96-103` (update existing test)

**Step 1: Update the sentinel test to verify non-empty sentinel content**

The existing test at line 96 checks that an empty string is inserted. Update it to check for the new sentinel value:

```typescript
  it('inserts sentinel line between non-contiguous added lines', () => {
    const result = buildContentBlock([
      { fileLineNumber: 5, text: 'abandon' },
      { fileLineNumber: 50, text: 'ability' },
    ])
    // Gap between line 5 and 50 → sentinel line inserted
    expect(result.content).toBe('abandon\n---bip39-guard-sentinel---\nability')
    expect(result.lineMap).toEqual([5, -1, 50])
  })
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run ts/check-staged.test.ts`
Expected: 1 FAIL (sentinel content mismatch), rest PASS

---

### Task 5: Sentinel Fix — Implementation in check-staged.ts

**Files:**
- Modify: `ts/check-staged.ts:109` (change sentinel value)

**Step 1: Change the sentinel from empty string to marker**

At line 109, change:
```typescript
      contentLines.push('')
```
to:
```typescript
      contentLines.push('---bip39-guard-sentinel---')
```

**Step 2: Run tests to verify they pass**

Run: `pnpm vitest run ts/check-staged.test.ts`
Expected: ALL PASS

Also run detect tests to confirm no regressions:
Run: `pnpm vitest run ts/detect.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add ts/check-staged.ts ts/check-staged.test.ts
git commit -m "fix: use non-empty sentinel to prevent cross-hunk spanning with blank-line tolerance"
```

---

### Task 6: Annotation Tokens — Failing Tests

**Files:**
- Modify: `ts/detect.test.ts` (add new tests in cross-line section)

**Step 1: Add test for annotated one-per-line format**

Add in the cross-line test section:

```typescript
  it('detects cross-line seed phrase with "Word N:" annotations', () => {
    const content = [
      'Word 1: abandon',
      'Word 2: ability',
      'Word 3: able',
      'Word 4: about',
      'Word 5: above',
    ].join('\n')
    const result = detectBip39Sequences(content)
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toEqual([
      'abandon', 'ability', 'able', 'about', 'above',
    ])
  })
```

**Step 2: Add test for "Mnemonic" annotation in single-line context**

```typescript
  it('detects single-line seed phrase with annotation tokens', () => {
    const result = detectBip39Sequences(
      'mnemonic: abandon ability able about above'
    )
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toEqual([
      'abandon', 'ability', 'able', 'about', 'above',
    ])
  })
```

**Step 3: Add test for mixed prose (should NOT detect)**

```typescript
  it('does NOT flag prose that happens to contain annotation tokens', () => {
    // "the" and "process" are non-BIP39, non-annotation words
    const content = [
      'the recovery process for abandon',
      'requires ability to able',
      'check about the above',
    ].join('\n')
    expect(detectBip39Sequences(content)).toEqual([])
  })
```

**Step 4: Add test for "Recovery phrase" and "Backup" annotations**

```typescript
  it('detects cross-line seed phrase with varied annotation labels', () => {
    const content = [
      'Recovery phrase:',
      'abandon',
      'ability',
      'able',
      'about',
      'above',
    ].join('\n')
    const result = detectBip39Sequences(content)
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toHaveLength(5)
  })
```

**Step 5: Add test confirming "seed" is treated as annotation, not BIP39**

Note: "seed" IS in the BIP39 wordlist. When it appears in annotation context (e.g., "seed phrase:"), it should be treated as an annotation token, not counted as a BIP39 match. However, when "seed" appears alongside other BIP39 words in a plain sequence, it should still count as BIP39. The annotation check only applies in `analyzeLine` for cross-line purity and as a SKIP in the single-line loop — but "seed" mid-sequence of other BIP39 words should still accumulate.

Actually, this creates a conflict: "seed" is both a BIP39 word and an annotation token. The correct behavior is: if a word is BOTH BIP39 and an annotation token, treat it as annotation (SKIP) — this is the conservative choice that avoids counting labels as seed words. A sequence like `seed abandon ability able about above` should detect 5 words (abandon through above), not 6.

```typescript
  it('treats "seed" as annotation token even though it is BIP39', () => {
    // "seed" at the start is a label, not part of the mnemonic
    const result = detectBip39Sequences(
      'seed abandon ability able about above'
    )
    expect(result).toHaveLength(1)
    // "seed" is skipped as annotation, so only 5 words detected
    expect(result[0].matchedWords).toEqual([
      'abandon', 'ability', 'able', 'about', 'above',
    ])
  })
```

**Step 6: Run tests to verify new ones fail**

Run: `pnpm vitest run ts/detect.test.ts`
Expected: New annotation tests FAIL, all others PASS

---

### Task 7: Annotation Tokens — Implementation in detect.ts

**Files:**
- Modify: `ts/detect.ts` (add allowlist + update analyzeLine + update Pass 1 loop)

**Step 1: Add annotation token set and checker after stripToken (after line 30)**

```typescript
/**
 * Annotation tokens commonly used to label seed phrase words.
 * Treated as transparent (SKIP) in both single-line and cross-line detection.
 */
const ANNOTATION_TOKENS = new Set([
  'word', 'words', 'mnemonic', 'seed', 'phrase',
  'key', 'backup', 'recovery', 'secret', 'passphrase',
])
```

**Step 2: Update analyzeLine to skip annotation tokens**

In `analyzeLine` (line 53-63), change the token classification. After `stripToken` returns a valid word, check if it's an annotation token before checking BIP39:

```typescript
  for (const token of tokens) {
    const stripped = stripToken(token)

    if (stripped === 'skip') continue // numbering, punctuation — ignore

    // Annotation tokens (word, mnemonic, seed, etc.) — treat as transparent
    if (stripped !== null && ANNOTATION_TOKENS.has(stripped)) continue

    hasAnyWord = true
    if (stripped !== null && BIP39_WORDS.has(stripped)) {
      bip39Words.push(stripped)
    } else {
      hasNonBip39Word = true
    }
  }
```

**Step 3: Update Pass 1 single-line loop to skip annotation tokens**

In the single-line detection loop (line 108-128), add annotation check after the `skip` check:

```typescript
    for (let j = 0; j < tokens.length; j++) {
      const stripped = stripToken(tokens[j])

      if (stripped === 'skip') continue

      // Annotation tokens — transparent, don't break or contribute to sequence
      if (stripped !== null && ANNOTATION_TOKENS.has(stripped)) continue

      if (stripped !== null && BIP39_WORDS.has(stripped)) {
        consecutive++
        matchedWords.push(stripped)
      } else {
        if (consecutive >= threshold) {
          violations.push({
            lineNumber: i + 1,
            matchedWords: matchedWords.slice(-consecutive),
            line: line,
          })
          reportedLines.add(i)
        }
        consecutive = 0
        matchedWords.length = 0
      }
    }
```

**Step 4: Run tests to verify all pass**

Run: `pnpm vitest run ts/detect.test.ts`
Expected: ALL PASS

**Important check:** The existing test at line 179-191 for TypeScript comments (`// Test wallet seed abandon ability...`) currently expects 9 matched words because "seed" is BIP39. With this change, "seed" becomes an annotation token and will be skipped, so the expected count changes from 9 to 8. Update that test:

At line 191, change:
```typescript
    expect(result[0].matchedWords).toHaveLength(9)
```
to:
```typescript
    // "seed" is now treated as annotation token (transparent), not counted
    expect(result[0].matchedWords).toHaveLength(8)
```

Similarly check the YAML test at line 241 — "mnemonic:" has a colon so it's already handled by stripToken (interior punctuation returns null). No change needed there.

**Step 5: Run full test suite**

Run: `pnpm vitest run ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add ts/detect.ts ts/detect.test.ts
git commit -m "feat: add annotation token allowlist for seed phrase labels"
```

---

### Task 8: Bash Parity — Blank-Line Tolerance

**Files:**
- Modify: `bash/check-bip39-seeds.sh:212-240` (cross-line accumulation block)

**Step 1: Add blank-line skip in cross-line block**

In the added-line processing block, right before the cross-line accumulation decision (after `# Cross-line accumulation` comment, around line 212), the code currently checks `line_reported`, `line_has_any_word`, etc. We need to add a check earlier: if the content (after stripping `+`) is empty/whitespace, skip the line without flushing cross-line state.

The check goes right after `lower_content` is set (around line 153). But we must be careful — the single-line loop still needs to run (it's a no-op on empty content). The key change is in the cross-line decision block. Currently lines 212-240 have:

```bash
      if [[ $line_reported -eq 1 ]]; then
        flush_cross_line
      elif [[ $line_has_any_word -eq 1 && ... ]]; then
        ...
      else
        flush_cross_line
      fi
```

Add a blank-line check at the very top of this block:

```bash
      # Cross-line accumulation
      # Blank/whitespace-only lines are transparent — skip without flushing
      if [[ -z "${content// /}" ]] || [[ -z "${content//$'\t'/}" ]]; then
        : # do nothing — transparent
      elif [[ $line_reported -eq 1 ]]; then
```

Actually, a cleaner approach — check if `lower_content` (after word-splitting) produced zero tokens. That's equivalent to `line_has_any_word -eq 0 && line_bip39_count -eq 0` with no break tokens. But simpler: just check if the stripped content is empty.

```bash
      # Cross-line accumulation
      # Blank/whitespace-only added lines are transparent — skip without flushing
      local trimmed_content
      trimmed_content=$(echo "$content" | tr -d '[:space:]')
      if [[ -z "$trimmed_content" ]]; then
        : # transparent — don't flush, don't accumulate
      elif [[ $line_reported -eq 1 ]]; then
        # Already reported by single-line — flush cross-line
        flush_cross_line
      elif [[ $line_has_any_word -eq 1 && $line_has_non_bip39_word -eq 0 && $line_bip39_count -gt 0 ]]; then
        # BIP39-pure line — accumulate
        ...  (existing accumulation code)
      else
        # Non-BIP39-pure line — flush cross-line
        flush_cross_line
      fi
```

Note: `local` in bash cannot be used outside functions. Since this is in the main loop (not a function), use a regular variable assignment without `local`. Just use `trimmed_content=...`.

**Step 2: Test with bash test script**

Create a temp test:
```bash
# In a temp git repo, stage a file with blank-separated BIP39 words:
# abandon\n\nability\n\nable\n\nabout\n\nabove
# Run: bash bash/check-bip39-seeds.sh
# Expected: DETECTED (5 words across blank lines)
```

Run the same 9-test bash script from the previous implementation to verify no regressions, plus add the blank-line test.

**Step 3: Commit**

```bash
git add bash/check-bip39-seeds.sh
git commit -m "feat(bash): add blank-line tolerance in cross-line detection"
```

---

### Task 9: Bash Parity — Annotation Tokens

**Files:**
- Modify: `bash/check-bip39-seeds.sh` (add annotation check after strip_token)

**Step 1: Add annotation token check function**

After the `strip_token` function (after line 47), add:

```bash
# Annotation tokens commonly used to label seed phrase words.
# Treated as transparent (SKIP) in both single-line and cross-line detection.
is_annotation_token() {
  case "$1" in
    word|words|mnemonic|seed|phrase|key|backup|recovery|secret|passphrase)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
```

**Step 2: Update single-line loop**

In the token processing loop (around line 183-201), after `strip_token "$token"` and the SKIP/BREAK cases, in the `*` case, add annotation check before `is_bip39`:

```bash
          *)
            # Check annotation tokens before BIP39
            if is_annotation_token "$STRIP_RESULT"; then
              continue
            fi
            line_has_any_word=1
            if is_bip39 "$STRIP_RESULT"; then
              ...
```

**Step 3: Update cross-line re-scan**

In the cross-line BIP39-pure accumulation rescan loop (around line 224-236), add the same annotation check:

```bash
        for token in $lower_content; do
          [[ -z "$token" ]] && continue
          strip_token "$token"
          [[ "$STRIP_RESULT" = "SKIP" || "$STRIP_RESULT" = "BREAK" ]] && continue
          if is_annotation_token "$STRIP_RESULT"; then
            continue
          fi
          if is_bip39 "$STRIP_RESULT"; then
            ...
```

**Step 4: Test with bash test script**

Add tests for:
- `Word 1: abandon\nWord 2: ability\nWord 3: able\nWord 4: about\nWord 5: above` → detected
- `mnemonic: abandon ability able about above` → detected (single-line)

**Step 5: Commit**

```bash
git add bash/check-bip39-seeds.sh
git commit -m "feat(bash): add annotation token allowlist"
```

---

### Task 10: Full Repo Scan — ts/scan-repo.ts

**Files:**
- Create: `ts/scan-repo.ts`
- Create: `ts/scan-repo.test.ts`

**Step 1: Write failing tests for scan-repo**

Create `ts/scan-repo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scanFiles } from './scan-repo'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'bip39-scan-'))
}

describe('scanFiles', () => {
  it('detects seed phrase in a file', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'secrets.txt'), 'abandon ability able about above')
    const result = scanFiles([join(dir, 'secrets.txt')])
    expect(result).toHaveLength(1)
    expect(result[0].file).toContain('secrets.txt')
    expect(result[0].matchedWords).toHaveLength(5)
  })

  it('returns empty for clean files', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'clean.txt'), 'hello world this is fine')
    const result = scanFiles([join(dir, 'clean.txt')])
    expect(result).toEqual([])
  })

  it('scans multiple files', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'a.txt'), 'abandon ability able about above')
    writeFileSync(join(dir, 'b.txt'), 'normal content here')
    writeFileSync(join(dir, 'c.txt'), 'zoo zone zero youth young you')
    const result = scanFiles([
      join(dir, 'a.txt'),
      join(dir, 'b.txt'),
      join(dir, 'c.txt'),
    ])
    expect(result).toHaveLength(2)
  })

  it('respects custom threshold', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'test.txt'), 'abandon ability able about above')
    expect(scanFiles([join(dir, 'test.txt')], 6)).toEqual([])
    expect(scanFiles([join(dir, 'test.txt')], 5)).toHaveLength(1)
  })

  it('skips binary files gracefully', () => {
    const dir = makeTempDir()
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])
    writeFileSync(join(dir, 'binary.bin'), buf)
    const result = scanFiles([join(dir, 'binary.bin')])
    expect(result).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run ts/scan-repo.test.ts`
Expected: FAIL (scanFiles not found)

**Step 3: Implement scan-repo.ts**

Create `ts/scan-repo.ts`:

```typescript
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { detectBip39Sequences } from './detect'

const LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
])

export interface ScanViolation {
  file: string
  lineNumber: number
  matchedWords: string[]
  line: string
}

function getBasename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

function isBinary(content: string): boolean {
  return content.includes('\0')
}

/**
 * Scan a list of file paths for BIP39 seed phrases.
 * Returns violations found across all files.
 */
export function scanFiles(
  files: string[],
  threshold: number = 5
): ScanViolation[] {
  const violations: ScanViolation[] = []

  for (const file of files) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue // skip unreadable files
    }

    if (isBinary(content)) continue

    const fileViolations = detectBip39Sequences(content, threshold)
    for (const v of fileViolations) {
      violations.push({
        file,
        lineNumber: v.lineNumber,
        matchedWords: v.matchedWords,
        line: v.line,
      })
    }
  }

  return violations
}

function getGitFiles(): string[] {
  try {
    const output = execFileSync('git', ['ls-files'], { encoding: 'utf-8' })
    return output.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function getFilesRecursive(dir: string): string[] {
  const { readdirSync, statSync } = require('fs')
  const { join } = require('path')
  const results: string[] = []

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '.git' || entry === 'node_modules') continue
        walk(full)
      } else {
        results.push(full)
      }
    }
  }

  walk(dir)
  return results
}

// ── CLI ──────────────────────────────────────────────────────────────

const isTTY = process.stderr.isTTY ?? false
const RED = isTTY ? '\x1b[0;31m' : ''
const GREEN = isTTY ? '\x1b[0;32m' : ''
const YELLOW = isTTY ? '\x1b[0;33m' : ''
const BOLD = isTTY ? '\x1b[1m' : ''
const NC = isTTY ? '\x1b[0m' : ''

function main(): void {
  const args = process.argv.slice(2)
  let mode: 'git' | 'dir' = 'git'
  let dirPath = '.'
  let includeLockfiles = false
  let threshold = parseInt(process.env.BIP39_THRESHOLD ?? '', 10) || 5
  let jsonOutput = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
        mode = 'dir'
        dirPath = args[++i]
        break
      case '--git':
        mode = 'git'
        break
      case '--include-lockfiles':
        includeLockfiles = true
        break
      case '--threshold':
        threshold = parseInt(args[++i], 10)
        break
      case '--json':
        jsonOutput = true
        break
    }
  }

  let files = mode === 'git' ? getGitFiles() : getFilesRecursive(dirPath)

  if (!includeLockfiles) {
    files = files.filter((f) => !LOCK_FILES.has(getBasename(f)))
  }

  const violations = scanFiles(files, threshold)

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(violations, null, 2) + '\n')
    process.exit(violations.length > 0 ? 1 : 0)
  }

  if (violations.length > 0) {
    process.stderr.write('\n')
    process.stderr.write(
      `${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}\n`
    )
    process.stderr.write(
      `${RED}${BOLD}║  BIP39 SEED PHRASE DETECTED                                 ║${NC}\n`
    )
    process.stderr.write(
      `${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}\n`
    )

    for (const v of violations) {
      process.stderr.write('\n')
      process.stderr.write(`  ${YELLOW}File: ${v.file}:${v.lineNumber}${NC}\n`)
      process.stderr.write(
        `  ${RED}Found ${v.matchedWords.length} consecutive BIP39 words:${NC}\n`
      )
      process.stderr.write(
        `  ${RED}  → ${v.matchedWords.join(' ')}${NC}\n`
      )
    }

    process.stderr.write('\n')
    process.stderr.write(
      `${RED}${BOLD}Found ${violations.length} violation(s).${NC}\n`
    )
    process.stderr.write('\n')
    process.exit(1)
  } else {
    process.stderr.write(
      `${GREEN}✓ No BIP39 seed phrases detected${NC}\n`
    )
    process.exit(0)
  }
}

const isDirectRun =
  process.argv[1]?.endsWith('scan-repo.ts') ||
  process.argv[1]?.endsWith('scan-repo')

if (isDirectRun) {
  main()
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run ts/scan-repo.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add ts/scan-repo.ts ts/scan-repo.test.ts
git commit -m "feat: add scan-repo command for full repository scanning"
```

---

### Task 11: Full Repo Scan — bash/scan-repo.sh

**Files:**
- Create: `bash/scan-repo.sh`

**Step 1: Create bash scan-repo script**

Create `bash/scan-repo.sh`. This script reuses the wordlist and detection functions from `check-bip39-seeds.sh` but scans tracked files instead of staged diffs.

The script should:
1. Accept `--git` (default), `--dir <path>`, `--include-lockfiles`, `--threshold <n>` flags
2. Enumerate files via `git ls-files` or `find`
3. For each file, read and scan for BIP39 sequences using the same detection logic
4. Report violations and exit 1 if found

Since the detection logic is substantial, the cleanest approach is to embed the same wordlist and functions inline (the script must be standalone per project requirements in AGENTS.md).

The full file scanning in bash uses the same `strip_token`, `is_bip39`, `is_annotation_token` functions, but instead of parsing diffs, it reads each file line by line and runs both single-line and cross-line detection.

**Step 2: Test manually**

```bash
# Create temp git repo with a seed phrase file
# Run: bash bash/scan-repo.sh --git
# Expected: DETECTED
```

**Step 3: Commit**

```bash
git add bash/scan-repo.sh
git commit -m "feat(bash): add scan-repo.sh for full repository scanning"
```

---

### Task 12: Documentation Update

**Files:**
- Modify: `README.md`

**Step 1: Update README with new features**

Add to the "Detected formats" table:
```
| Blank-separated blocks | `abandon ability`<br><br>`able about above` |
| Annotated one-per-line | `Word 1: abandon`<br>`Word 2: ability`<br>`...` |
```

Add a new section for scan-repo:
```markdown
## Full Repository Scan

For CI pipelines or manual auditing, scan all tracked files (not just staged changes):

### TypeScript
\`\`\`bash
pnpm exec tsx ts/scan-repo.ts
\`\`\`

### Bash
\`\`\`bash
bash bash/scan-repo.sh
\`\`\`

### Options

| Flag | Description |
|---|---|
| `--git` | (Default) Scan git-tracked files |
| `--dir <path>` | Scan all files in directory recursively |
| `--include-lockfiles` | Include lockfiles in scan (excluded by default) |
| `--threshold <n>` | Override detection threshold (default: 5) |
| `--json` | Output violations as JSON (TypeScript only) |
```

Add a note about annotation tokens:
```markdown
### Annotation tokens

Common seed-labeling words (`word`, `words`, `mnemonic`, `seed`, `phrase`, `key`, `backup`, `recovery`, `secret`, `passphrase`) are treated as transparent — they don't break or contribute to a BIP39 sequence. This catches formats like `Word 1: abandon` without false-flagging documentation that mentions "seed phrase" in prose.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document blank-line tolerance, annotation tokens, and scan-repo command"
```

---

### Task 13: Final Verification

**Step 1: Run full test suite**

Run: `pnpm vitest run ts`
Expected: ALL PASS

**Step 2: Run bash tests**

Run the comprehensive bash test script covering all 9 original cases plus blank-line and annotation cases.
Expected: ALL PASS

**Step 3: Verify no regressions in check-staged integration**

Run: `pnpm vitest run ts/check-staged.test.ts`
Expected: ALL PASS

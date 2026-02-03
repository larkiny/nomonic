import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { detectBip39Sequences } from './detect'
import { execFileSync, spawnSync } from 'child_process'
import { mkdtempSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import {
  extractAddedLines,
  buildContentBlock,
  getBasename,
  getThreshold,
  getStagedFiles,
  getStagedDiff,
  main,
} from './check-staged'

const CLI_PATH = resolve(import.meta.dirname, 'check-staged.ts')

function runCheckStaged(options: {
  cwd: string
  env?: Record<string, string>
}): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('npx', ['tsx', CLI_PATH], {
    encoding: 'utf-8',
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}

function makeTempGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bip39-staged-'))
  execFileSync('git', ['init', dir], { stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  // Create an initial commit so diff --cached works
  writeFileSync(join(dir, '.gitkeep'), '')
  execFileSync('git', ['add', '.gitkeep'], { cwd: dir })
  execFileSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
    cwd: dir,
    stdio: 'ignore',
  })
  return dir
}

describe('extractAddedLines', () => {
  it('parses hunk headers and returns correct file line numbers', () => {
    const diff = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,4 @@',
      ' line one',
      ' line two',
      '+added at line 3',
      ' line three',
    ].join('\n')
    const result = extractAddedLines(diff)
    expect(result).toEqual([{ fileLineNumber: 3, text: 'added at line 3' }])
  })

  it('handles multiple hunks with correct line numbers', () => {
    const diff = [
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,4 @@',
      ' context',
      '+added at line 2',
      ' context',
      ' context',
      '@@ -10,3 +11,4 @@',
      ' context',
      '+added at line 12',
      ' context',
    ].join('\n')
    const result = extractAddedLines(diff)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ fileLineNumber: 2, text: 'added at line 2' })
    expect(result[1]).toEqual({ fileLineNumber: 12, text: 'added at line 12' })
  })

  it('does not advance line counter for removed lines', () => {
    const diff = [
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,4 +1,4 @@',
      ' kept',
      '-removed',
      '-also removed',
      '+added at line 2',
      '+added at line 3',
      ' context at line 4',
    ].join('\n')
    const result = extractAddedLines(diff)
    expect(result).toHaveLength(2)
    expect(result[0].fileLineNumber).toBe(2)
    expect(result[1].fileLineNumber).toBe(3)
  })

  it('handles hunk header with trailing context text', () => {
    const diff = [
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -5,3 +10,4 @@ function foo() {',
      ' context',
      '+added at line 11',
      ' context',
    ].join('\n')
    const result = extractAddedLines(diff)
    expect(result).toEqual([{ fileLineNumber: 11, text: 'added at line 11' }])
  })

  it('returns empty array for diff with no added lines', () => {
    const diff = [
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,2 @@',
      ' context',
      '-removed line',
      ' context',
    ].join('\n')
    expect(extractAddedLines(diff)).toEqual([])
  })
})

describe('buildContentBlock', () => {
  it('joins contiguous added lines without gaps', () => {
    const result = buildContentBlock([
      { fileLineNumber: 5, text: 'abandon' },
      { fileLineNumber: 6, text: 'ability' },
      { fileLineNumber: 7, text: 'able' },
    ])
    expect(result.content).toBe('abandon\nability\nable')
    expect(result.lineMap).toEqual([5, 6, 7])
  })

  it('inserts empty line between non-contiguous added lines', () => {
    const result = buildContentBlock([
      { fileLineNumber: 5, text: 'abandon' },
      { fileLineNumber: 50, text: 'ability' },
    ])
    // Gap between line 5 and 50 → non-empty sentinel line inserted
    expect(result.content).toBe('abandon\n---nomonic-sentinel---\nability')
    expect(result.lineMap).toEqual([5, -1, 50])
  })

  it('prevents cross-line detection from spanning hunk gaps', () => {
    // Simulate two hunks: 3 BIP39 words at lines 1-3, then 3 more at lines 50-52
    // Without gap handling, these 6 words would be detected as one cross-line sequence
    const block = buildContentBlock([
      { fileLineNumber: 1, text: 'abandon' },
      { fileLineNumber: 2, text: 'ability' },
      { fileLineNumber: 3, text: 'able' },
      { fileLineNumber: 50, text: 'about' },
      { fileLineNumber: 51, text: 'above' },
      { fileLineNumber: 52, text: 'absent' },
    ])
    const violations = detectBip39Sequences(block.content)
    // Each group of 3 is below threshold (5) — should NOT detect
    expect(violations).toEqual([])
  })

  it('detects cross-line mnemonic within a single contiguous hunk', () => {
    const block = buildContentBlock([
      { fileLineNumber: 10, text: 'abandon' },
      { fileLineNumber: 11, text: 'ability' },
      { fileLineNumber: 12, text: 'able' },
      { fileLineNumber: 13, text: 'about' },
      { fileLineNumber: 14, text: 'above' },
    ])
    const violations = detectBip39Sequences(block.content)
    expect(violations).toHaveLength(1)
    expect(violations[0].matchedWords).toHaveLength(5)
    // Map violation line number back to file line
    const fileLineNumber = block.lineMap[violations[0].lineNumber - 1]
    expect(fileLineNumber).toBe(10)
  })

  it('maps violation line numbers correctly with gaps', () => {
    // 5 contiguous BIP39 words at lines 20-24, preceded by a non-contiguous line
    const block = buildContentBlock([
      { fileLineNumber: 5, text: 'some code' },
      { fileLineNumber: 20, text: 'abandon' },
      { fileLineNumber: 21, text: 'ability' },
      { fileLineNumber: 22, text: 'able' },
      { fileLineNumber: 23, text: 'about' },
      { fileLineNumber: 24, text: 'above' },
    ])
    const violations = detectBip39Sequences(block.content)
    expect(violations).toHaveLength(1)
    const fileLineNumber = block.lineMap[violations[0].lineNumber - 1]
    expect(fileLineNumber).toBe(20)
  })
})

describe('BIP39 detection against realistic file content', () => {
  it('detects seed phrase in .env with space-separated words', () => {
    // Most dangerous format: MNEMONIC= followed by bare words
    const envContent = `DATABASE_URL=postgres://localhost:5432/mydb
SECRET_KEY=abc123
MNEMONIC= abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
PORT=3000`
    const result = detectBip39Sequences(envContent)
    expect(result).toHaveLength(1)
    expect(result[0].lineNumber).toBe(3)
    expect(result[0].matchedWords).toHaveLength(12)
  })

  it('detects .env with quoted mnemonic including last word', () => {
    const envContent = `MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"`
    const result = detectBip39Sequences(envContent)
    expect(result).toHaveLength(1)
    // MNEMONIC="abandon is one token — M is alpha on left, n is alpha on right,
    // so no stripping occurs. Interior =" means no match.
    // The 10 middle tokens are clean. about" → strip trailing " → about matches.
    // Total: 10 middle + 1 last = 11
    expect(result[0].matchedWords).toHaveLength(11)
  })

  it('detects seed phrase in a TypeScript comment', () => {
    // "seed:" has a colon so it won't match, but the 8 bare words after it will
    const tsContent = `import { Wallet } from 'algosdk'

// Test wallet seed abandon ability able about above absent absorb abstract
const wallet = new Wallet()
wallet.connect()`
    const result = detectBip39Sequences(tsContent)
    expect(result).toHaveLength(1)
    expect(result[0].lineNumber).toBe(3)
    // "//", "test", "wallet" are not BIP39/not alpha-only; "seed" is an annotation token (skipped)
    // so: abandon ability able about above absent absorb abstract = 8
    expect(result[0].matchedWords).toHaveLength(8)
  })

  it('detects JSON array with BIP39 words after stripping punctuation', () => {
    const jsonContent = `{
  "name": "my-project",
  "mnemonic": ["abandon", "ability", "able", "about", "above", "absent"],
  "version": "1.0.0"
}`
    const result = detectBip39Sequences(jsonContent)
    expect(result).toHaveLength(1)
    expect(result[0].lineNumber).toBe(3)
    expect(result[0].matchedWords).toHaveLength(6)
  })

  it('returns no violations for clean Python file', () => {
    const pyContent = `def calculate(x, y):
    """Calculate the sum of two numbers."""
    return x + y

class MyService:
    def __init__(self, config):
        self.config = config`
    expect(detectBip39Sequences(pyContent)).toEqual([])
  })

  it('returns no violations for markdown with scattered BIP39 words', () => {
    const mdContent = `# Project README

We need to abandon this approach and find a new able solution.
The system should act differently when processing large datasets.
Please air your concerns in the next meeting.`
    expect(detectBip39Sequences(mdContent)).toEqual([])
  })

  it('does NOT flag prose with punctuation breaking sequences', () => {
    // This is the exact pattern from the PRD that caused the original false positive
    const prose =
      "External contributors (developers not on the project's team) indicate genuine open-source health. They're weighted at 2x."
    expect(detectBip39Sequences(prose)).toEqual([])
  })

  it('detects seed phrase in YAML config with bare words', () => {
    const yamlContent = `app:
  name: my-dapp
  mnemonic: abandon ability able about above absent absorb abstract absurd abuse access accident
  network: testnet`
    const result = detectBip39Sequences(yamlContent)
    expect(result).toHaveLength(1)
    // "mnemonic:" has a colon so doesn't match; the 12 bare words do
    expect(result[0].matchedWords).toHaveLength(12)
  })
})

describe('getBasename', () => {
  it('extracts basename from a path with slashes', () => {
    expect(getBasename('src/utils/file.ts')).toBe('file.ts')
  })

  it('returns the full string when no slashes present', () => {
    expect(getBasename('file.ts')).toBe('file.ts')
  })

  it('handles trailing slash by returning empty string', () => {
    expect(getBasename('src/utils/')).toBe('')
  })
})

describe('getThreshold', () => {
  const originalEnv = process.env.BIP39_THRESHOLD

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BIP39_THRESHOLD
    } else {
      process.env.BIP39_THRESHOLD = originalEnv
    }
  })

  it('returns 5 when BIP39_THRESHOLD is not set', () => {
    delete process.env.BIP39_THRESHOLD
    expect(getThreshold()).toBe(5)
  })

  it('returns parsed value when valid env is set', () => {
    process.env.BIP39_THRESHOLD = '10'
    expect(getThreshold()).toBe(10)
  })

  it('returns 5 and warns on invalid env (non-numeric)', () => {
    process.env.BIP39_THRESHOLD = 'abc'
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(getThreshold()).toBe(5)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid BIP39_THRESHOLD'),
    )
    stderrSpy.mockRestore()
  })

  it('returns 5 and warns on invalid env (negative)', () => {
    process.env.BIP39_THRESHOLD = '-1'
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(getThreshold()).toBe(5)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid BIP39_THRESHOLD'),
    )
    stderrSpy.mockRestore()
  })

  it('returns 5 and warns on zero', () => {
    process.env.BIP39_THRESHOLD = '0'
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(getThreshold()).toBe(5)
    stderrSpy.mockRestore()
  })
})

describe('check-staged main() in-process', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('exits 0 with success message when no files are staged', () => {
    const dir = makeTempGitRepo()
    // No files staged after initial commit
    const origCwd = process.cwd()
    process.chdir(dir)
    try {
      main()
    } finally {
      process.chdir(origCwd)
    }
    expect(exitSpy).toHaveBeenCalledWith(0)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('No BIP39')
  })

  it('exits 1 with violation details when staged file has seed phrase', () => {
    const dir = makeTempGitRepo()
    writeFileSync(
      join(dir, 'seed.txt'),
      'abandon ability able about above absent absorb abstract\n',
    )
    execFileSync('git', ['add', 'seed.txt'], { cwd: dir })
    const origCwd = process.cwd()
    process.chdir(dir)
    try {
      main()
    } finally {
      process.chdir(origCwd)
    }
    expect(exitSpy).toHaveBeenCalledWith(1)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('BIP39')
    expect(output).toContain('seed.txt')
  })

  it('exits 0 when staged file is clean', () => {
    const dir = makeTempGitRepo()
    writeFileSync(join(dir, 'clean.txt'), 'hello world\n')
    execFileSync('git', ['add', 'clean.txt'], { cwd: dir })
    const origCwd = process.cwd()
    process.chdir(dir)
    try {
      main()
    } finally {
      process.chdir(origCwd)
    }
    expect(exitSpy).toHaveBeenCalledWith(0)
    const output = stderrSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('No BIP39')
  })
})

describe('check-staged CLI (subprocess)', () => {
  it('exits 1 when staged file contains seed phrase', () => {
    const dir = makeTempGitRepo()
    writeFileSync(
      join(dir, 'seed.txt'),
      'abandon ability able about above absent absorb abstract\n',
    )
    execFileSync('git', ['add', 'seed.txt'], { cwd: dir })
    const { exitCode, stderr } = runCheckStaged({ cwd: dir })
    expect(exitCode).toBe(1)
    expect(stderr).toContain('BIP39')
  })

  it('exits 0 when staged file is clean', () => {
    const dir = makeTempGitRepo()
    writeFileSync(join(dir, 'clean.txt'), 'hello world\n')
    execFileSync('git', ['add', 'clean.txt'], { cwd: dir })
    const { exitCode, stderr } = runCheckStaged({ cwd: dir })
    expect(exitCode).toBe(0)
    expect(stderr).toContain('No BIP39')
  })

  it('respects BIP39_THRESHOLD env var', () => {
    const dir = makeTempGitRepo()
    // 6 consecutive BIP39 words — default threshold (5) catches this
    writeFileSync(
      join(dir, 'mild.txt'),
      'abandon ability able about above absent\n',
    )
    execFileSync('git', ['add', 'mild.txt'], { cwd: dir })
    // Set threshold high so it passes
    const { exitCode } = runCheckStaged({
      cwd: dir,
      env: { BIP39_THRESHOLD: '12' },
    })
    expect(exitCode).toBe(0)
  })

  it('skips lock files by default', () => {
    const dir = makeTempGitRepo()
    writeFileSync(
      join(dir, 'package-lock.json'),
      'abandon ability able about above absent absorb abstract\n',
    )
    execFileSync('git', ['add', 'package-lock.json'], { cwd: dir })
    const { exitCode } = runCheckStaged({ cwd: dir })
    expect(exitCode).toBe(0)
  })

  it('exits 0 when no files are staged', () => {
    const dir = makeTempGitRepo()
    const { exitCode, stderr } = runCheckStaged({ cwd: dir })
    expect(exitCode).toBe(0)
    expect(stderr).toContain('No BIP39')
  })
})

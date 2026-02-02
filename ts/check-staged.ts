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

const isTTY = process.stderr.isTTY ?? false
const RED = isTTY ? '\x1b[0;31m' : ''
const GREEN = isTTY ? '\x1b[0;32m' : ''
const YELLOW = isTTY ? '\x1b[0;33m' : ''
const BOLD = isTTY ? '\x1b[1m' : ''
const NC = isTTY ? '\x1b[0m' : ''

interface FileViolation {
  file: string
  lineNumber: number
  matchedWords: string[]
}

function getBasename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

function getStagedFiles(): string[] {
  try {
    const output = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=d'],
      { encoding: 'utf-8' },
    )
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((f) => !LOCK_FILES.has(getBasename(f)))
  } catch {
    return []
  }
}

function getStagedDiff(file: string): string {
  try {
    return execFileSync('git', ['diff', '--cached', '--', file], {
      encoding: 'utf-8',
    })
  } catch {
    return ''
  }
}

export interface AddedLine {
  fileLineNumber: number
  text: string
}

export function extractAddedLines(diff: string): AddedLine[] {
  const result: AddedLine[] = []
  let currentLine = 0

  for (const line of diff.split('\n')) {
    // Parse hunk headers: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/)
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10)
      continue
    }

    // Skip file headers
    if (line.startsWith('+++') || line.startsWith('---')) continue

    if (line.startsWith('+')) {
      result.push({ fileLineNumber: currentLine, text: line.slice(1) })
      currentLine++
    } else if (line.startsWith('-')) {
      // Removed line — does not advance the new-file line counter
    } else {
      // Context line — advances the counter
      currentLine++
    }
  }

  return result
}

export interface ContentBlock {
  content: string
  lineMap: number[] // maps content line index → file line number (-1 for sentinels)
}

/**
 * Build a content block from added lines, inserting empty sentinel lines
 * between non-contiguous lines so cross-line detection doesn't span gaps.
 */
export function buildContentBlock(addedLines: AddedLine[]): ContentBlock {
  const contentLines: string[] = []
  const lineMap: number[] = []

  for (let i = 0; i < addedLines.length; i++) {
    // Insert empty sentinel between non-contiguous lines
    if (
      i > 0 &&
      addedLines[i].fileLineNumber !== addedLines[i - 1].fileLineNumber + 1
    ) {
      contentLines.push('---nomonic-sentinel---')
      lineMap.push(-1)
    }
    contentLines.push(addedLines[i].text)
    lineMap.push(addedLines[i].fileLineNumber)
  }

  return { content: contentLines.join('\n'), lineMap }
}

function getThreshold(): number {
  const env = process.env.BIP39_THRESHOLD
  if (env === undefined) return 5
  const parsed = parseInt(env, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    process.stderr.write(
      `${YELLOW}⚠ Invalid BIP39_THRESHOLD="${env}", using default (5)${NC}\n`,
    )
    return 5
  }
  return parsed
}

function main(): void {
  const threshold = getThreshold()
  const files = getStagedFiles()
  if (files.length === 0) {
    process.stderr.write(
      `${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}\n`,
    )
    process.exit(0)
  }

  const allViolations: FileViolation[] = []

  for (const file of files) {
    const diff = getStagedDiff(file)
    if (!diff) continue

    const addedLines = extractAddedLines(diff)
    if (addedLines.length === 0) continue

    const { content, lineMap } = buildContentBlock(addedLines)
    const violations = detectBip39Sequences(content, threshold)
    for (const v of violations) {
      const blockIndex = v.lineNumber - 1
      const fileLineNumber =
        blockIndex < lineMap.length
          ? lineMap[blockIndex]
          : lineMap[lineMap.length - 1]
      allViolations.push({
        file,
        lineNumber: fileLineNumber,
        matchedWords: v.matchedWords,
      })
    }
  }

  if (allViolations.length > 0) {
    process.stderr.write('\n')
    if (isTTY) {
      process.stderr.write(
        `${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}\n`,
      )
      process.stderr.write(
        `${RED}${BOLD}║  BIP39 SEED PHRASE DETECTED — COMMIT BLOCKED                 ║${NC}\n`,
      )
      process.stderr.write(
        `${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}\n`,
      )
    } else {
      process.stderr.write(
        '=== BIP39 SEED PHRASE DETECTED — COMMIT BLOCKED ===\n',
      )
    }

    for (const v of allViolations) {
      process.stderr.write('\n')
      process.stderr.write(`  ${YELLOW}File: ${v.file}:${v.lineNumber}${NC}\n`)
      process.stderr.write(
        `  ${RED}Found ${v.matchedWords.length} consecutive BIP39 words:${NC}\n`,
      )
      process.stderr.write(`  ${RED}  → ${v.matchedWords.join(' ')}${NC}\n`)
    }

    process.stderr.write('\n')
    process.stderr.write(
      `${RED}${BOLD}Commit blocked.${NC} ${RED}Remove seed phrases before committing.${NC}\n`,
    )
    process.stderr.write(
      `${RED}Use ${BOLD}git commit --no-verify${NC} ${RED}to bypass (not recommended).${NC}\n`,
    )
    process.stderr.write('\n')
    process.exit(1)
  } else {
    process.stderr.write(
      `${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}\n`,
    )
    process.exit(0)
  }
}

// Only run when executed directly (not when imported for testing)
const isDirectRun =
  process.argv[1]?.endsWith('check-staged.ts') ||
  process.argv[1]?.endsWith('check-staged')

if (isDirectRun) {
  main()
}

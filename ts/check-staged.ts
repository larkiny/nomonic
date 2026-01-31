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
      { encoding: 'utf-8' }
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

function extractAddedContent(diff: string): string {
  const lines: string[] = []
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) {
      lines.push(line.slice(1))
    }
  }
  return lines.join('\n')
}

function main(): void {
  const files = getStagedFiles()
  if (files.length === 0) {
    process.stderr.write(
      `${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}\n`
    )
    process.exit(0)
  }

  const allViolations: FileViolation[] = []

  for (const file of files) {
    const diff = getStagedDiff(file)
    if (!diff) continue

    const addedContent = extractAddedContent(diff)
    const violations = detectBip39Sequences(addedContent)

    for (const v of violations) {
      allViolations.push({
        file,
        lineNumber: v.lineNumber,
        matchedWords: v.matchedWords,
      })
    }
  }

  if (allViolations.length > 0) {
    process.stderr.write('\n')
    process.stderr.write(
      `${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}\n`
    )
    process.stderr.write(
      `${RED}${BOLD}║  BIP39 SEED PHRASE DETECTED — COMMIT BLOCKED                ║${NC}\n`
    )
    process.stderr.write(
      `${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}\n`
    )

    for (const v of allViolations) {
      process.stderr.write('\n')
      process.stderr.write(`  ${YELLOW}File: ${v.file}${NC}\n`)
      process.stderr.write(
        `  ${RED}Found ${v.matchedWords.length} consecutive BIP39 words:${NC}\n`
      )
      process.stderr.write(
        `  ${RED}  → ${v.matchedWords.join(' ')}${NC}\n`
      )
    }

    process.stderr.write('\n')
    process.stderr.write(
      `${RED}${BOLD}Commit blocked.${NC} ${RED}Remove seed phrases before committing.${NC}\n`
    )
    process.stderr.write(
      `${RED}Use ${BOLD}git commit --no-verify${NC} ${RED}to bypass (not recommended).${NC}\n`
    )
    process.stderr.write('\n')
    process.exit(1)
  } else {
    process.stderr.write(
      `${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}\n`
    )
    process.exit(0)
  }
}

main()

import { readFileSync } from 'fs'
import { join } from 'path'

const IGNORE_FILE = '.nomonicignore'

export function loadIgnorePatterns(cwd: string = process.cwd()): string[] {
  try {
    const content = readFileSync(join(cwd, IGNORE_FILE), 'utf-8')
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  } catch {
    return []
  }
}

export function compilePattern(pattern: string): RegExp {
  let anchored = false
  let p = pattern

  if (p.startsWith('/')) {
    anchored = true
    p = p.slice(1)
  }

  if (p.endsWith('/')) {
    p = p + '**'
  }

  // Build regex character by character, handling glob tokens
  let regex = ''
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        // **/ = zero or more directories
        regex += '(?:.+/)?'
        i += 2 // skip **/
      } else {
        // ** at end or mid = match everything
        regex += '.*'
        i += 1 // skip **
      }
    } else if (p[i] === '*') {
      regex += '[^/]*'
    } else if (p[i] === '?') {
      regex += '[^/]'
    } else if ('.+^${}()|[]\\'.includes(p[i])) {
      regex += '\\' + p[i]
    } else {
      regex += p[i]
    }
  }

  if (anchored) {
    return new RegExp('^' + regex + '$')
  }
  return new RegExp('(?:^|/)' + regex + '$')
}

export function isIgnored(filePath: string, patterns: RegExp[]): boolean {
  const normalized = filePath.startsWith('./') ? filePath.slice(2) : filePath
  for (const pat of patterns) {
    if (pat.test(normalized)) return true
  }
  return false
}

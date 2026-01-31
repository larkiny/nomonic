import { BIP39_WORDS } from './wordlist'

export interface Bip39Violation {
  lineNumber: number
  matchedWords: string[]
  line: string
}

/**
 * Detect sequences of consecutive BIP39 mnemonic words in text content.
 * Returns violations where `threshold` or more consecutive BIP39 words appear on a single line.
 */
export function detectBip39Sequences(
  content: string,
  threshold: number = 5
): Bip39Violation[] {
  if (!content) return []

  const violations: Bip39Violation[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Tokenize: split on whitespace, then check each token as-is.
    // A token only matches if it's a pure alphabetic BIP39 word — punctuation
    // attached to a word (e.g. "team)", "they're", "open-source") disqualifies it,
    // since real mnemonics are clean space-separated words.
    const tokens = line
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase())

    let consecutive = 0
    let matchStart = 0

    for (let j = 0; j < tokens.length; j++) {
      if (/^[a-z]+$/.test(tokens[j]) && BIP39_WORDS.has(tokens[j])) {
        if (consecutive === 0) matchStart = j
        consecutive++
      } else {
        if (consecutive >= threshold) {
          violations.push({
            lineNumber: i + 1,
            matchedWords: tokens.slice(matchStart, matchStart + consecutive),
            line: line,
          })
        }
        consecutive = 0
      }
    }

    // Check trailing sequence at end of line
    if (consecutive >= threshold) {
      violations.push({
        lineNumber: i + 1,
        matchedWords: tokens.slice(matchStart, matchStart + consecutive),
        line: line,
      })
    }
  }

  return violations
}

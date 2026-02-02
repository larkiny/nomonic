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

import { describe, it, expect } from 'vitest'
import { detectBip39Sequences } from './detect'

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

  it('does NOT flag .env with quoted mnemonic (quotes break token matching)', () => {
    // Quoted format: each token includes the quote characters
    const envContent = `MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"`
    const result = detectBip39Sequences(envContent)
    // First token is "MNEMONIC="abandon" and last is "about"" — both have punctuation
    // The 10 middle tokens (abandon x9 + abandon) are clean and form a sequence
    expect(result).toHaveLength(1)
    expect(result[0].matchedWords).toHaveLength(10)
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
    // "//", "test", "wallet" are not BIP39/not alpha-only; "seed" IS BIP39
    // so: seed abandon ability able about above absent absorb abstract = 9
    expect(result[0].matchedWords).toHaveLength(9)
  })

  it('does NOT flag JSON array format (quotes around each word)', () => {
    const jsonContent = `{
  "name": "my-project",
  "mnemonic": ["abandon", "ability", "able", "about", "above", "absent"],
  "version": "1.0.0"
}`
    // Every word is wrapped in quotes like "abandon", — not a clean token
    expect(detectBip39Sequences(jsonContent)).toEqual([])
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

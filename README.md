# bip39-guard

Pre-commit hook that detects BIP39 mnemonic seed phrases in staged files and blocks the commit. Prevents accidental secret leaks that have historically led to exploits in the Algorand ecosystem.

## Quick Start

Run this from your project root:

```bash
curl -fsSL https://raw.githubusercontent.com/algorandfoundation/bip39-guard/main/setup.sh | bash
```

That's it. The script will:

1. **Detect your project type** — Node.js (`package.json`) or non-Node
2. **Install the right version** — TypeScript for Node.js projects, Bash for everything else
3. **Configure git hooks** — Sets up Husky (Node.js) or raw git hooks, installing dependencies as needed
4. **Run on every commit** — Scans staged files before each `git commit`

## How It Works

The detector scans `git diff --cached` (staged changes) for sequences of consecutive BIP39 words. Surrounding punctuation (quotes, commas, brackets, etc.) is stripped before matching, so seed phrases are caught regardless of formatting. Words with **interior** punctuation (hyphens, apostrophes) are still disqualified — this prevents false positives on normal prose like `"open-source health. They're"`.

Detection works in two passes:

1. **Single-line** — finds sequences of BIP39 words within each line
2. **Cross-line** — accumulates words across consecutive lines where every token is a BIP39 word, catching one-per-line and grid formats

This catches standard 12/24-word BIP39 mnemonics as well as legacy 25-word Algorand account mnemonics (which use the same wordlist).

### Detected formats

| Format | Example |
|---|---|
| Space-separated | `abandon ability able about above` |
| Comma-separated | `abandon, ability, able, about, above` |
| Quoted CSV | `"abandon", "ability", "able", "about", "above"` |
| JSON arrays | `["abandon", "ability", "able", "about", "above"]` |
| Numbered (single line) | `1. abandon 2. ability 3. able 4. about 5. above` |
| Numbered (multi-line) | `1. force`<br>`2. clay`<br>`3. airport`<br>`...` |
| Grid layout (Algorand wallet) | `1. force 2. clay 3. airport`<br>`4. shoot 5. fence 6. fine`<br>`...` |
| Plain one-per-line | `force`<br>`clay`<br>`airport`<br>`...` |

### What gets scanned

- All staged text files (added/modified lines only)
- Lock files are skipped (`package-lock.json`, `yarn.lock`, etc.)
- Binary files are skipped

### What triggers a block

5 or more consecutive words that are all:
- Present in the [BIP39 English wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt) (2048 words)
- Purely alphabetic after stripping surrounding punctuation
- Free of interior punctuation (hyphens, apostrophes, etc.)

## Configuration

Adjust the detection threshold via environment variable:

```bash
# Require 8+ consecutive words instead of the default 5
export BIP39_THRESHOLD=8
```

## Bypassing

For legitimate cases (e.g., committing the detector files themselves on first install):

```bash
git commit --no-verify
```

## Updating

Re-run the setup command to pull the latest detector files:

```bash
curl -fsSL https://raw.githubusercontent.com/algorandfoundation/bip39-guard/main/setup.sh | bash
```

The script is idempotent — it won't duplicate hook entries.

## Uninstalling

1. Remove the BIP39 check line from your pre-commit hook:
   - **Husky:** Edit `.husky/pre-commit`, delete the `npx tsx scripts/bip39/check-staged.ts` line
   - **Git hooks:** Edit `.git/hooks/pre-commit`, delete the `./scripts/check-bip39-seeds.sh` line
2. Delete the detector files:
   - **TypeScript:** `rm -rf scripts/bip39/`
   - **Bash:** `rm scripts/check-bip39-seeds.sh`

## What's in the repo

```
bash/
  check-bip39-seeds.sh     # Standalone bash detector (zero dependencies)
ts/
  wordlist.ts              # BIP39 English wordlist as a Set
  detect.ts                # Core detection algorithm
  detect.test.ts           # Unit tests (vitest)
  check-staged.ts          # CLI entry point
  check-staged.test.ts     # Integration tests (vitest)
setup.sh                   # One-command installer
```

## License

MIT

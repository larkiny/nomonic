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

## Why This Exists

BIP39 mnemonic phrases are the master keys to cryptocurrency wallets. Anyone who obtains a seed phrase has full, irreversible access to all funds in that wallet. Developers working on blockchain projects routinely handle seed phrases during testing, wallet integration, and key management — and a single accidental `git commit` can expose them in version history permanently (even if the file is deleted later, it remains in git's object store).

This has happened in the Algorand ecosystem and across the broader crypto space. bip39-guard acts as a safety net: a pre-commit hook that catches seed phrases before they enter version control.

## How It Works

The detector scans `git diff --cached` (staged changes) for sequences of consecutive words from the [BIP39 English wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt) (2048 common English words). The core methodology:

1. **Tokenization with punctuation stripping** — Each token is stripped of surrounding non-alphabetic characters (quotes, commas, brackets, numbering like `1.`, etc.) before matching. This catches seed phrases in any common formatting. Tokens with *interior* punctuation (hyphens, apostrophes) are disqualified entirely — this is the primary false-positive defense, since normal English prose contains contractions (`they're`) and compound words (`open-source`) that would otherwise match.

2. **Single-line detection** — Finds runs of consecutive BIP39 words within each line. Non-BIP39 words reset the counter. This handles space-separated, comma-separated, JSON array, and inline numbered formats.

3. **Cross-line detection** — Accumulates BIP39 words across consecutive lines where *every* meaningful token is a BIP39 word ("BIP39-pure" lines). Blank lines and lines containing only annotation labels (like `Word 1:` or `Recovery phrase:`) are transparent — they don't break or contribute to a sequence. This catches one-per-line, numbered list, and grid formats.

4. **Threshold gating** — A violation is only reported when 5 or more consecutive BIP39 words are found (configurable via `BIP39_THRESHOLD`). Since the BIP39 wordlist contains common English words, shorter sequences occur naturally in prose.

This catches standard 12/24-word BIP39 mnemonics as well as legacy 25-word Algorand account mnemonics (which use the same wordlist).

## Limitations

bip39-guard is a best-effort safety net, not a guarantee. Known limitations:

- **Only detects English BIP39 words** — BIP39 defines wordlists for multiple languages (Japanese, Spanish, Chinese, etc.). This tool only checks the English list.
- **Pre-commit hook is bypassable** — `git commit --no-verify` skips all hooks. The full-repo scanner (`scan-repo`) can be used in CI to catch what hooks miss.
- **Staged diffs only (hook mode)** — The pre-commit hook only scans newly added/modified lines. Seed phrases already in the repository history are not caught. Use `scan-repo` for full-repo auditing.
- **Obfuscated phrases are not detected** — Seed words that are base64-encoded, encrypted, split across variables, reversed, or otherwise transformed will not be caught.
- **False positives are possible** — The BIP39 wordlist contains common English words (`abandon`, `ability`, `access`, `art`, `carbon`, `code`, etc.). Technical documentation or prose that happens to use 5+ consecutive BIP39 words will trigger a block. Raise the threshold or use `--no-verify` for legitimate cases.
- **False negatives are possible** — Seed phrases with unusual formatting not covered by the tokenizer (e.g., tab-separated without spaces, embedded in URLs, mixed with non-whitespace delimiters) may not be detected.
- **No checksum validation** — The detector does not verify that the word sequence forms a valid BIP39 mnemonic with correct checksum. It flags any run of BIP39 words meeting the threshold, whether or not it's a valid key.

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
| Blank-separated blocks | `abandon ability`<br><br>`able about above` |
| Annotated one-per-line | `Word 1: abandon`<br>`Word 2: ability`<br>`...` |
| Labeled phrases | `mnemonic: abandon ability able about above` |

### What gets scanned

- All staged text files (added/modified lines only)
- Lock files are skipped (`package-lock.json`, `yarn.lock`, etc.)
- Binary files are skipped

### What triggers a block

5 or more consecutive words that are all:
- Present in the [BIP39 English wordlist](https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt) (2048 words)
- Purely alphabetic after stripping surrounding punctuation
- Free of interior punctuation (hyphens, apostrophes, etc.)

Common seed-labeling words (`word`, `words`, `mnemonic`, `seed`, `phrase`, `key`, `backup`, `recovery`, `secret`, `passphrase`) are treated as transparent — they don't break or contribute to a BIP39 sequence. This catches formats like `Word 1: abandon` without false-flagging documentation that mentions "seed phrase" in prose.

## Full Repository Scan

For CI pipelines or manual auditing, scan all tracked files (not just staged changes):

### TypeScript

```bash
pnpm exec tsx ts/scan-repo.ts
```

### Bash

```bash
bash bash/scan-repo.sh
```

### Options

| Flag | Description |
|---|---|
| `--git` | (Default) Scan git-tracked files |
| `--dir <path>` | Scan all files in directory recursively |
| `--include-lockfiles` | Include lockfiles in scan (excluded by default) |
| `--threshold <n>` | Override detection threshold (default: 5) |
| `--json` | Output violations as JSON (TypeScript only) |

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
  scan-repo.sh             # Full-repo scanner (zero dependencies)
ts/
  wordlist.ts              # BIP39 English wordlist as a Set
  detect.ts                # Core detection algorithm
  detect.test.ts           # Unit tests (vitest)
  check-staged.ts          # CLI entry point (pre-commit hook)
  check-staged.test.ts     # Integration tests (vitest)
  scan-repo.ts             # Full-repo scanner CLI
  scan-repo.test.ts        # Scanner tests (vitest)
setup.sh                   # One-command installer
```

## License

MIT

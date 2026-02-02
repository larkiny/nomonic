#!/usr/bin/env bash
set -euo pipefail

# nomonic — One-command installer
# Usage: curl -fsSL https://raw.githubusercontent.com/larkiny/nomonic/main/setup.sh | bash

REPO_RAW="https://raw.githubusercontent.com/larkiny/nomonic/main"

# ─── Colors (only if terminal) ───────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BOLD='' NC=''
fi

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

# ─── Pre-checks ──────────────────────────────────────────────────────────────
[[ -d .git ]] || error "Not a git repository. Run this from your project root."

# ─── Detect package manager ──────────────────────────────────────────────────
detect_pm() {
  if [[ -f "bun.lockb" ]]; then echo "bun"
  elif [[ -f "pnpm-lock.yaml" ]]; then echo "pnpm"
  elif [[ -f "yarn.lock" ]]; then echo "yarn"
  else echo "npm"
  fi
}

pm_install() {
  local pm="$1"
  shift
  case "$pm" in
    bun)  bun add -D "$@" ;;
    pnpm) pnpm add -D "$@" ;;
    yarn) yarn add -D "$@" ;;
    npm)  npm install -D "$@" ;;
  esac
}

pm_exec() {
  local pm="$1"
  shift
  case "$pm" in
    bun)  bunx "$@" ;;
    pnpm) pnpm exec "$@" ;;
    yarn) yarn "$@" ;;
    npm)  npx "$@" ;;
  esac
}

# ─── Download helper ─────────────────────────────────────────────────────────
download() {
  local url="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  if command -v curl &>/dev/null; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget &>/dev/null; then
    wget -q "$url" -O "$dest"
  else
    error "Neither curl nor wget found. Install one and retry."
  fi
}

# ─── Detect project type and install ─────────────────────────────────────────
if [[ -f "package.json" ]]; then
  # ── Node.js project → TypeScript version ──
  echo -e "${BOLD}Setting up nomonic (TypeScript)...${NC}"
  PM=$(detect_pm)
  info "Detected package manager: $PM"

  # Download TS files
  download "$REPO_RAW/ts/wordlist.ts"         "scripts/nomonic/wordlist.ts"
  download "$REPO_RAW/ts/detect.ts"           "scripts/nomonic/detect.ts"
  download "$REPO_RAW/ts/ignore.ts"           "scripts/nomonic/ignore.ts"
  download "$REPO_RAW/ts/check-staged.ts"     "scripts/nomonic/check-staged.ts"
  download "$REPO_RAW/ts/scan-repo.ts"        "scripts/nomonic/scan-repo.ts"
  info "Downloaded detector to scripts/nomonic/"

  # Ensure tsx is available
  if ! grep -q '"tsx"' package.json 2>/dev/null; then
    info "Installing tsx..."
    pm_install "$PM" tsx
  fi

  # Set up Husky
  HOOK_LINE="npx tsx scripts/nomonic/check-staged.ts"

  if [[ -d ".husky" ]]; then
    info "Husky already configured"
  else
    info "Installing and initializing Husky..."
    pm_install "$PM" husky
    pm_exec "$PM" husky init
  fi

  # Create or update pre-commit hook
  HOOK_FILE=".husky/pre-commit"
  if [[ -f "$HOOK_FILE" ]] && grep -qF "$HOOK_LINE" "$HOOK_FILE"; then
    info "BIP39 check already in pre-commit hook"
  elif [[ -f "$HOOK_FILE" ]]; then
    # Prepend to existing hook
    EXISTING=$(cat "$HOOK_FILE")
    printf '%s\n%s\n' "# Check for BIP39 seed phrases (nomonic)" "$HOOK_LINE" > "$HOOK_FILE"
    echo "" >> "$HOOK_FILE"
    echo "$EXISTING" >> "$HOOK_FILE"
    info "Added BIP39 check to existing .husky/pre-commit"
  else
    printf '%s\n%s\n' "# Check for BIP39 seed phrases (nomonic)" "$HOOK_LINE" > "$HOOK_FILE"
    info "Created .husky/pre-commit with BIP39 check"
  fi

else
  # ── Non-Node project → Bash version ──
  echo -e "${BOLD}Setting up nomonic (Bash)...${NC}"

  download "$REPO_RAW/bash/check-bip39-seeds.sh" "scripts/nomonic/check-bip39-seeds.sh"
  download "$REPO_RAW/bash/scan-repo.sh"          "scripts/nomonic/scan-repo.sh"
  chmod +x "scripts/nomonic/check-bip39-seeds.sh"
  chmod +x "scripts/nomonic/scan-repo.sh"
  info "Downloaded detector to scripts/nomonic/"

  # Set up git hook
  HOOK_LINE="./scripts/nomonic/check-bip39-seeds.sh"
  HOOK_FILE=".git/hooks/pre-commit"

  if [[ -L "$HOOK_FILE" ]]; then
    warn "$HOOK_FILE is a symlink — skipping automatic hook setup"
    warn "Add this line manually to your pre-commit hook:"
    echo "  $HOOK_LINE"
  elif [[ -f "$HOOK_FILE" ]] && grep -qF "$HOOK_LINE" "$HOOK_FILE"; then
    info "BIP39 check already in pre-commit hook"
  elif [[ -f "$HOOK_FILE" ]]; then
    EXISTING=$(cat "$HOOK_FILE")
    printf '%s\n%s\n\n%s\n' "#!/usr/bin/env bash" "# Check for BIP39 seed phrases (nomonic)" "$HOOK_LINE" > "$HOOK_FILE"
    # Append existing content, skipping any shebang line
    echo "$EXISTING" | grep -v '^#!/' >> "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    info "Added BIP39 check to existing .git/hooks/pre-commit"
  else
    printf '%s\n\n%s\n%s\n' "#!/usr/bin/env bash" "# Check for BIP39 seed phrases (nomonic)" "$HOOK_LINE" > "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    info "Created .git/hooks/pre-commit with BIP39 check"
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}nomonic installed successfully!${NC}"
echo ""
echo "To test, stage a file containing a BIP39 mnemonic and run git commit."
echo "To bypass: git commit --no-verify"
echo "To configure threshold: export BIP39_THRESHOLD=8"
echo "To ignore paths: create .nomonicignore (one glob pattern per line)"
echo ""

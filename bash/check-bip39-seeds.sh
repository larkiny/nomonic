#!/usr/bin/env bash
set -euo pipefail

# nomonic — BIP39 Seed Phrase Pre-Commit Guard
# Detects sequences of 8+ consecutive BIP39 mnemonic words in staged files.
# Usage: Add to .husky/pre-commit or run manually before committing.
# Portable: Bash 3.2+ (macOS default) and git. No other dependencies.

THRESHOLD=${BIP39_THRESHOLD:-8}

# Write the wordlist to a temp file for grep-based lookup (Bash 3.2 compatible)
BIP39_FILE=$(mktemp)
trap 'rm -f "$BIP39_FILE"' EXIT

# Full BIP39 English wordlist (2048 words), one per line
tr ' ' '\n' <<'WORDLIST' > "$BIP39_FILE"
abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canoe canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle caught cause caution cave ceiling celery cement census century cereal certain chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk churn cigar cinnamon circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic crop cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology economy edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact end endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip era erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face faculty fade faint faith fall false fame family famous fan fancy fantasy farm fashion fat fatal father fatigue fault favorite feature february federal fee feed feel female fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil fold follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garage garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grass gravity great green grid grief grit grocery group grow grunt guard guess guide guilt guitar gun gym habit hair half hammer hamster hand happy harbor hard harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn horror horse hospital host hotel hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon idea identify idle ignore ill illegal illness image imitate immense immune impact impose improve impulse inch include income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kidney kind kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab label labor ladder lady lake lamp language laptop large later latin laugh laundry lava law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lumber lunar lunch luxury lyrics machine mad magic magnet maid mail main major make mammal man manage mandate mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory mention menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mixture mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery myth naive name napkin narrow nasty nation nature near neck need negative neglect neither nephew nerve nest net network neutral never news next nice night noble noise nominee noodle normal north nose notable note nothing notice novel now nuclear number nurse nut oak obey object oblige obscure observe obtain obvious occur ocean october odor off offer office often oil okay old olive olympic omit once one onion online only open opera opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone pact paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patient patrol pattern pause pave payment peace peanut pear peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie room rose rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seed seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling sick side siege sight sign silent silk silly silver similar simple since sing siren sister situate six size skate sketch ski skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare spatial spawn speak special speed spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stool story stove strategy street strike strong struggle student stuff stumble style subject submit subway success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise surround survey suspect sustain swallow swamp swap swarm swear sweet swift swim swing switch sword symbol symptom syrup system table tackle tag tail talent talk tank tape target task taste tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tide tiger tilt timber time tiny tip tired tissue title toast tobacco today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture venue verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel weather web wedding weekend weird welcome west wet whale what wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo
WORDLIST

# Check if a word is in the BIP39 wordlist
is_bip39() {
  grep -qx "$1" "$BIP39_FILE"
}

# Strip surrounding non-alpha characters from a token and classify it.
# Sets STRIP_RESULT to: the stripped lowercase word, "SKIP" (entirely non-alpha),
# or "BREAK" (interior punctuation like hyphens/apostrophes, or digits in
# stripped portions like board[0] or abandon123).
strip_token() {
  local t="$1"
  # Strip leading non-alpha
  local leading="${t%%[a-zA-Z]*}"
  local core="${t#"$leading"}"
  if [[ -z "$core" ]]; then
    STRIP_RESULT="SKIP"
    return
  fi
  # Strip trailing non-alpha
  local trailing="${core##*[a-zA-Z]}"
  core="${core%"$trailing"}"
  # Check for interior non-alpha
  case "$core" in
    *[!a-zA-Z]*)
      STRIP_RESULT="BREAK"
      return
      ;;
  esac
  # If stripped leading/trailing portions contain digits, the token is
  # likely a code construct (e.g. board[0], abandon123) — disqualify it.
  if [[ "$leading" =~ [0-9] ]] || [[ "$trailing" =~ [0-9] ]]; then
    STRIP_RESULT="BREAK"
    return
  fi
  # Return lowercase
  STRIP_RESULT=$(echo "$core" | tr '[:upper:]' '[:lower:]')
}

# Annotation tokens commonly used to label seed phrase words.
# Treated as transparent (SKIP) in both single-line and cross-line detection.
is_annotation_token() {
  case "$1" in
    word|words|mnemonic|seed|phrase|key|backup|recovery|secret|passphrase)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Flush cross-line accumulation if it meets the threshold.
# Uses global vars: cross_words, cross_count, cross_start_line
flush_cross_line() {
  if [[ $cross_count -ge $THRESHOLD ]]; then
    report_violation "$current_file" "$cross_start_line" "$cross_count" "$cross_words"
  fi
  cross_words=""
  cross_count=0
  cross_start_line=0
}

# ANSI color codes — only emit if stderr is a terminal
if [[ -t 2 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BOLD=''
  NC=''
fi

# Lock files to skip
LOCK_FILES="package-lock.json yarn.lock pnpm-lock.yaml bun.lockb Cargo.lock Gemfile.lock poetry.lock composer.lock"

# Load ignore patterns from .nomonicignore
IGNORE_PATTERNS=()
if [[ -f ".nomonicignore" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    [[ "$line" = \#* ]] && continue
    IGNORE_PATTERNS+=("$line")
  done < ".nomonicignore"
fi

is_ignored() {
  local filepath="$1"
  filepath="${filepath#./}"
  [[ ${#IGNORE_PATTERNS[@]} -eq 0 ]] && return 1
  local pattern p
  for pattern in "${IGNORE_PATTERNS[@]}"; do
    p="$pattern"
    [[ "$p" = /* ]] && p="${p#/}"
    # Collapse ** to * (bash case * already crosses /)
    p="${p//\*\*/*}"
    # shellcheck disable=SC2254
    case "$filepath" in
      $p) return 0 ;;
    esac
  done
  return 1
}

found_violations=0
header_printed=0

print_header() {
  if [[ $header_printed -eq 0 ]]; then
    echo "" >&2
    if [[ -t 2 ]]; then
      echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}" >&2
      echo -e "${RED}${BOLD}║  BIP39 SEED PHRASE DETECTED — COMMIT BLOCKED                ║${NC}" >&2
      echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}" >&2
    else
      echo "=== BIP39 SEED PHRASE DETECTED — COMMIT BLOCKED ===" >&2
    fi
    header_printed=1
  fi
}

report_violation() {
  local file="$1" line_num="$2" count="$3" words="$4"
  print_header
  found_violations=$((found_violations + 1))
  echo "" >&2
  echo -e "  ${YELLOW}File: ${file}:${line_num}${NC}" >&2
  echo -e "  ${RED}Found ${count} consecutive BIP39 words:${NC}" >&2
  echo -e "  ${RED}  → ${words}${NC}" >&2
}

# Get staged files (excluding deleted)
staged_files=$(git diff --cached --name-only --diff-filter=d 2>/dev/null || true)

if [[ -z "$staged_files" ]]; then
  echo -e "${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}" >&2
  exit 0
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  # Skip lock files
  basename_file="${file##*/}"
  skip=false
  for lockfile in $LOCK_FILES; do
    if [[ "$basename_file" = "$lockfile" ]]; then
      skip=true
      break
    fi
  done
  $skip && continue

  # Skip ignored paths
  if is_ignored "$file"; then
    continue
  fi

  # Get the diff for this file
  diff_output=$(git diff --cached -- "$file" 2>/dev/null || true)
  [[ -z "$diff_output" ]] && continue

  current_file="$file"
  current_line=0

  # Cross-line state
  cross_words=""
  cross_count=0
  cross_start_line=0

  while IFS= read -r line; do
    # Parse diff hunk headers for line numbers
    if [[ "$line" =~ ^@@\ -[0-9]+(,[0-9]+)?\ \+([0-9]+)(,[0-9]+)?\ @@ ]]; then
      current_line=${BASH_REMATCH[2]}
      flush_cross_line
      continue
    fi

    # Skip diff file headers
    if [[ "$line" = "+++"* ]] || [[ "$line" = "---"* ]]; then
      continue
    fi

    if [[ "$line" = "+"* ]]; then
      # Added line — remove the leading '+'
      content="${line##+}"

      # Lowercase the content, split on whitespace
      lower_content=$(echo "$content" | tr '[:upper:]' '[:lower:]')

      consecutive=0
      matched_words=""
      line_reported=0
      line_bip39_count=0
      line_has_non_bip39_word=0
      line_has_any_word=0

      for token in $lower_content; do
        [[ -z "$token" ]] && continue

        strip_token "$token"

        case "$STRIP_RESULT" in
          SKIP)
            # Purely non-alpha (e.g. "1.", "//") — skip without breaking sequence
            continue
            ;;
          BREAK)
            # Interior punctuation (e.g. "they're", "open-source") — flush sequence
            if [[ $consecutive -ge $THRESHOLD ]]; then
              report_violation "$file" "$current_line" "$consecutive" "$matched_words"
              line_reported=1
            fi
            consecutive=0
            matched_words=""
            line_has_non_bip39_word=1
            line_has_any_word=1
            ;;
          *)
            # Check annotation tokens before BIP39
            if is_annotation_token "$STRIP_RESULT"; then
              continue
            fi
            line_has_any_word=1
            if is_bip39 "$STRIP_RESULT"; then
              consecutive=$((consecutive + 1))
              line_bip39_count=$((line_bip39_count + 1))
              if [[ -z "$matched_words" ]]; then
                matched_words="$STRIP_RESULT"
              else
                matched_words="$matched_words $STRIP_RESULT"
              fi
            else
              if [[ $consecutive -ge $THRESHOLD ]]; then
                report_violation "$file" "$current_line" "$consecutive" "$matched_words"
                line_reported=1
              fi
              consecutive=0
              matched_words=""
              line_has_non_bip39_word=1
            fi
            ;;
        esac
      done

      # Check trailing sequence at end of line
      if [[ $consecutive -ge $THRESHOLD ]]; then
        report_violation "$file" "$current_line" "$consecutive" "$matched_words"
        line_reported=1
      fi

      # Cross-line accumulation
      # Blank/whitespace-only lines and annotation-only lines are transparent
      trimmed_content=$(echo "$content" | tr -d '[:space:]')
      if [[ -z "$trimmed_content" ]]; then
        : # blank line — transparent
      elif [[ $line_has_any_word -eq 0 && $line_bip39_count -eq 0 ]]; then
        : # annotation/skip-only line — transparent
      elif [[ $line_reported -eq 1 ]]; then
        # Already reported by single-line — flush cross-line
        flush_cross_line
      elif [[ $line_has_any_word -eq 1 && $line_has_non_bip39_word -eq 0 && $line_bip39_count -gt 0 ]]; then
        # BIP39-pure line — accumulate for cross-line detection
        if [[ $cross_count -eq 0 ]]; then
          cross_start_line=$current_line
        fi
        # Gather all BIP39 words from this line (rebuild from matched state)
        # We need to re-extract because matched_words only has the trailing run
        # Re-scan for all BIP39 words on this line
        for token in $lower_content; do
          [[ -z "$token" ]] && continue
          strip_token "$token"
          [[ "$STRIP_RESULT" = "SKIP" || "$STRIP_RESULT" = "BREAK" ]] && continue
          if is_annotation_token "$STRIP_RESULT"; then
            continue
          fi
          if is_bip39 "$STRIP_RESULT"; then
            if [[ -z "$cross_words" ]]; then
              cross_words="$STRIP_RESULT"
            else
              cross_words="$cross_words $STRIP_RESULT"
            fi
            cross_count=$((cross_count + 1))
          fi
        done
      else
        # Non-BIP39-pure line — flush cross-line
        flush_cross_line
      fi

      current_line=$((current_line + 1))
    elif [[ "$line" != "-"* ]]; then
      # Context line (no +/- prefix) — flush cross-line, advance line counter
      flush_cross_line
      current_line=$((current_line + 1))
    fi
    # Removed lines ("-" prefix) — implicitly flush cross-line
    # (they don't enter either branch above, so no flush needed since
    #  they don't contribute added content, but we should flush)
    if [[ "$line" = "-"* ]] && [[ "$line" != "---"* ]]; then
      flush_cross_line
    fi
  done <<< "$diff_output"

  # Flush remaining cross-line accumulation at end of file
  flush_cross_line
done <<< "$staged_files"

if [[ $found_violations -gt 0 ]]; then
  echo "" >&2
  echo -e "${RED}${BOLD}Commit blocked.${NC} ${RED}Remove seed phrases before committing.${NC}" >&2
  echo -e "${RED}Use ${BOLD}git commit --no-verify${NC} ${RED}to bypass (not recommended).${NC}" >&2
  echo "" >&2
  exit 1
else
  echo -e "${GREEN}✓ No BIP39 seed phrases detected in staged files${NC}" >&2
  exit 0
fi

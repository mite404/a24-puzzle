#!/bin/bash
# Ralph Docker Loop
# Runs Claude in isolated container, backup/git runs on HOST

set -e

# Configuration
IMAGE_NAME="ralph-a24"
PROJECT_DIR="$(pwd)"
MODEL="${RALPH_MODEL:-opus}"

# Validate model against whitelist (security: prevents command injection)
validate_model() {
  local model="$1"
  case "$model" in
    opus|sonnet|haiku) return 0 ;;
    *)
      echo "Error: Invalid model '$model'. Allowed: opus, sonnet, haiku"
      exit 1
      ;;
  esac
}
validate_model "$MODEL"
PLAN_FILE="IMPLEMENTATION_PLAN.md"
LOG_FILE="ralph.log"

# SAFETY: Verify PROJECT_DIR is safe to mount
if [ -z "$PROJECT_DIR" ] || [ "$PROJECT_DIR" = "/" ] || [ "$PROJECT_DIR" = "$HOME" ]; then
  echo "FATAL: Refusing to mount unsafe directory: $PROJECT_DIR"
  echo "Run this script from inside a project directory, not ~ or /"
  exit 1
fi

# Verify we're in a Ralph project
if [ ! -f "PROMPT_build.md" ] && [ ! -f "PROMPT_plan.md" ]; then
  echo "FATAL: Not a Ralph project directory (no PROMPT_*.md files)"
  echo "Run /setup-ralph first or cd into a Ralph project"
  exit 1
fi

# SAFETY: must be a standalone clone, never a git worktree. A worktree's .git is
# a pointer file to history living outside the mount, so git breaks in-container.
if [ ! -d ".git" ]; then
  echo "FATAL: .git is not a real directory — this looks like a git worktree."
  echo "Ralph needs a standalone clone so its history is inside the mount."
  exit 1
fi

# SAFETY: no remote means no possible push. Re-checked every run so the seal
# cannot silently decay if someone adds an origin later.
if [ -n "$(git remote)" ]; then
  echo "FATAL: this repo has a git remote configured:"
  git remote -v | sed 's/^/  /'
  echo "Ralph runs unattended with --dangerously-skip-permissions; its commits"
  echo "must stay local. Remove it first:  git remote remove <name>"
  exit 1
fi

# Load OAuth token (with security checks)
TOKEN_FILE="$HOME/.claude-oauth-token"
if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  if [ -f "$TOKEN_FILE" ]; then
    # Security: Check file permissions (should be 600 or more restrictive)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      TOKEN_PERMS=$(stat -f %Lp "$TOKEN_FILE" 2>/dev/null)
    else
      TOKEN_PERMS=$(stat -c %a "$TOKEN_FILE" 2>/dev/null)
    fi

    if [ -n "$TOKEN_PERMS" ] && [ "$((TOKEN_PERMS % 100))" -ne 0 ]; then
      echo "⚠️  Security warning: $TOKEN_FILE has insecure permissions ($TOKEN_PERMS)"
      echo "   Run: chmod 600 $TOKEN_FILE"
      echo ""
    fi

    CLAUDE_CODE_OAUTH_TOKEN=$(cat "$TOKEN_FILE")
  else
    echo "Error: No OAuth token found"
    echo "Run 'claude setup-token' and save to ~/.claude-oauth-token"
    echo "Then: chmod 600 ~/.claude-oauth-token"
    exit 1
  fi
fi

# Handle --build-image flag
if [ "$1" = "--build-image" ]; then
  echo "Building Docker image..."
  docker build -t "$IMAGE_NAME" .
  echo "Image built: $IMAGE_NAME"
  exit 0
fi

# Check if image exists
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Docker image not found. Building..."
  docker build -t "$IMAGE_NAME" .
fi

# Parse arguments
MODE="build"
LIMIT=""
while [[ $# -gt 0 ]]; do
  case $1 in
    plan) MODE="plan"; shift ;;
    [0-9]*) LIMIT=$1; shift ;;
    --model) MODEL=$2; validate_model "$MODEL"; shift 2 ;;
    *) shift ;;
  esac
done

# ============================================================================
# NOTE: the stock template's remote-backup functions lived here. They ran
# `gh repo create --private --source=. --push` and `git push origin HEAD` after
# every iteration. Both are deleted, not disabled — there is no flag that can
# turn them back on. Ralph commits locally; you fetch when you want the work:
#
#   git fetch /Users/ea/Programming/web/fractal/ralph-a24 crossword-eval
#
# ============================================================================
# COMPLETION DETECTION (runs on HOST)
# ============================================================================

check_complete() {
  if [ ! -f "$PLAN_FILE" ]; then
    return 1
  fi

  local incomplete=$(grep -c '^\s*- \[ \]' "$PLAN_FILE" 2>/dev/null || echo "0")
  if [ "$incomplete" -eq 0 ]; then
    local completed=$(grep -c '^\s*- \[x\]' "$PLAN_FILE" 2>/dev/null || echo "0")
    [ "$completed" -gt 0 ] && return 0
  fi
  return 1
}

# ============================================================================
# MAIN
# ============================================================================

# Select prompt
if [ "$MODE" = "plan" ]; then
  PROMPT_FILE="PROMPT_plan.md"
  echo "Ralph Planning Mode (Docker)"
else
  PROMPT_FILE="PROMPT_build.md"
  echo "Ralph Building Mode (Docker)"
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: $PROMPT_FILE not found"
  exit 1
fi

# Only the eval-harness tasks need this; every task before them runs offline.
ENV_ARGS=(-e "CLAUDE_CODE_OAUTH_TOKEN=$CLAUDE_CODE_OAUTH_TOKEN")
if [ -n "$OPENROUTER_API_KEY" ]; then
  ENV_ARGS+=(-e "OPENROUTER_API_KEY=$OPENROUTER_API_KEY")
  OPENROUTER_STATUS="passed from environment"
elif [ -f ".env.local" ] && grep -q '^OPENROUTER_API_KEY=' .env.local; then
  OPENROUTER_STATUS="present in .env.local (read by the harness)"
else
  OPENROUTER_STATUS="NOT SET — eval-run tasks will block"
fi

echo "Project:    $PROJECT_DIR"
echo "Model:      $MODEL"
echo "Remote:     none — commits stay local"
echo "OpenRouter: $OPENROUTER_STATUS"
[ -n "$LIMIT" ] && echo "Limit:      $LIMIT iterations" || echo "Limit:      until plan complete"
echo ""
echo "Starting loop..."
echo "---"

echo "=== Ralph Docker $(date '+%Y-%m-%d %H:%M:%S') ===" > "$LOG_FILE"

ITERATION=0
while true; do
  ITERATION=$((ITERATION + 1))

  echo ""
  echo "Iteration $ITERATION - $(date '+%H:%M:%S')"

  # Check completion (build mode only)
  if [ "$MODE" = "build" ] && check_complete; then
    echo "ALL TASKS COMPLETE"
    exit 0
  fi

  # Check limit
  if [ -n "$LIMIT" ] && [ "$ITERATION" -gt "$LIMIT" ]; then
    echo "Reached limit ($LIMIT)"
    exit 0
  fi

  # Run single iteration in Docker. The container runs ONE task, commits, exits.
  # Next iteration starts with completely fresh context.
  # Note: MODEL is already validated against the whitelist above.
  if docker run --rm \
    -v "$PROJECT_DIR:/workspace" \
    -w /workspace \
    "${ENV_ARGS[@]}" \
    "$IMAGE_NAME" \
    bash -c "cat '$PROMPT_FILE' | claude --model '$MODEL' -p --dangerously-skip-permissions --output-format text" \
    2>&1 | tee -a "$LOG_FILE"; then

    echo "Iteration $ITERATION complete"
  else
    echo "Claude exited with error"
    exit 1
  fi

  sleep 1
done

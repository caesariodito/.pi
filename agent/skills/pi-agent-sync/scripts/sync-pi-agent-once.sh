#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN=1
  shift
fi

usage() {
  cat <<'USAGE'
Usage:
  sync-pi-agent-once.sh [--dry-run] <ssh-target> [remote-agent-dir]

Examples:
  sync-pi-agent-once.sh --dry-run 100.116.19.90
  sync-pi-agent-once.sh 100.116.19.90
  sync-pi-agent-once.sh sesar@100.116.19.90 /home/sesar/.pi/agent

Syncs:
  AGENTS.md, settings.json, models.json
  git/, extensions/, skills/, prompts/, themes/

Skips:
  auth.json, sessions/, bin/
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

SOURCE_AGENT_DIR="${SOURCE_AGENT_DIR:-$HOME/.pi/agent}"
SSH_TARGET="$1"
REMOTE_AGENT_DIR="${2:-~/.pi/agent}"

[[ -f "$SOURCE_AGENT_DIR/AGENTS.md" ]] || { echo "Missing: $SOURCE_AGENT_DIR/AGENTS.md" >&2; exit 1; }
command -v ssh >/dev/null || { echo "Missing command: ssh" >&2; exit 1; }
command -v rsync >/dev/null || { echo "Missing command: rsync" >&2; exit 1; }

RSYNC_FLAGS=(-av)
if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_FLAGS=(-av --dry-run --itemize-changes)
  echo "Mode: dry-run"
else
  echo "Mode: real sync"
fi

echo "Source: $SOURCE_AGENT_DIR"
echo "Target: $SSH_TARGET:$REMOTE_AGENT_DIR"
echo

echo "Checking SSH connection..."
ssh -o ConnectTimeout=8 "$SSH_TARGET" "mkdir -p $REMOTE_AGENT_DIR"

sync_file_if_present() {
  local name="$1"
  if [[ -f "$SOURCE_AGENT_DIR/$name" ]]; then
    echo "Syncing $name..."
    rsync "${RSYNC_FLAGS[@]}" "$SOURCE_AGENT_DIR/$name" "$SSH_TARGET:$REMOTE_AGENT_DIR/$name"
  else
    echo "Skipping missing optional file: $SOURCE_AGENT_DIR/$name"
  fi
}

sync_dir_if_present() {
  local name="$1"
  if [[ -d "$SOURCE_AGENT_DIR/$name" ]]; then
    echo "Syncing $name/..."
    ssh -o ConnectTimeout=8 "$SSH_TARGET" "mkdir -p $REMOTE_AGENT_DIR/$name"
    rsync "${RSYNC_FLAGS[@]}" --delete \
      --exclude='.DS_Store' \
      --exclude='pi-agent-sync/scripts/sync-pi-agent-once.sh' \
      "$SOURCE_AGENT_DIR/$name/" \
      "$SSH_TARGET:$REMOTE_AGENT_DIR/$name/"
  else
    echo "Skipping missing optional dir: $SOURCE_AGENT_DIR/$name"
  fi
}

sync_file_if_present AGENTS.md
sync_file_if_present settings.json
sync_file_if_present models.json

sync_dir_if_present git
sync_dir_if_present extensions
sync_dir_if_present skills
sync_dir_if_present prompts
sync_dir_if_present themes

echo
if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry-run complete. No files changed. Run without --dry-run to sync."
else
  echo "Done. On target Pi, run /reload or restart Pi."
fi

echo "Skipped auth.json, sessions/, bin/ by design."

#!/usr/bin/env sh
# Wire up the git hooks in .githooks/. Idempotent — safe to re-run.
#
#   Run once after cloning:   bash scripts/install-hooks.sh
#   Also runs automatically:  frontend/ `bun install` (its "prepare" script).
#
# No-ops outside a git work tree (Docker/CI image builds have no worktree).
set -e
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Resolve to the repo root so this works wherever it's invoked from
# (repo root, frontend/ prepare, or a Conductor worktree).
cd "$(git rev-parse --show-toplevel)"

# Layer 1 — core.hooksPath. A relative path resolves against each worktree's own
# root, so every fresh clone/worktree gets the gate at checkout time.
git config core.hooksPath .githooks

# Layer 2 — forwarding shims in the shared hooks dir. Claude Code / Conductor
# worktree creation can reset core.hooksPath back to the default hooks dir,
# silently disabling the gate repo-wide. git runs client-side hooks with cwd at
# the active worktree's root, so a shim that execs ./.githooks/<name> fires no
# matter which value core.hooksPath currently holds.
hooks_dir="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$hooks_dir"
for hook in .githooks/*; do
  [ -e "$hook" ] || continue
  name=$(basename "$hook")
  printf '#!/bin/sh\nexec ./.githooks/%s "$@"\n' "$name" >"$hooks_dir/$name"
  chmod +x "$hooks_dir/$name"
done

echo "install-hooks: core.hooksPath=.githooks + forwarding shims OK"

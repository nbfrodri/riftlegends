#!/usr/bin/env bash
# Prints the working context for a new agent session (Claude via SessionStart hook, Codex via AGENTS.md).
# Read-only. Never fails the session: every step degrades gracefully.
set -u
root="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || dirname "$0")"
cd "$root" || exit 0

echo "# Contexto de la sesión (scripts/session-context.sh)"
echo
echo "Decisiones vigentes: docs/decisions/README.md (léelo antes de preguntar algo ya decidido)."
echo
echo "## Git"
echo "Rama actual: $(git branch --show-current 2>/dev/null)"
git worktree list 2>/dev/null | sed 's/^/- worktree: /'
echo

echo "## Handoffs abiertos (docs/handoffs/)"
shopt -s nullglob
files=(docs/handoffs/*.md)
if [ ${#files[@]} -eq 0 ]; then
	echo "Ninguno."
else
	for f in "${files[@]}"; do
		echo
		echo "### $f"
		cat "$f"
	done
fi
echo

echo "## Issues en curso (tablero)"
if command -v gh >/dev/null 2>&1; then
	timeout 8 gh issue list --state open --assignee @me --json number,title,milestone \
		--jq '.[] | "- #\(.number) \(.title) [\(.milestone.title // "sin milestone")]"' 2>/dev/null \
		|| echo "No disponible (sin red o sin gh)."
else
	echo "No disponible (gh no instalado)."
fi

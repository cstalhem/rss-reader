#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

# uv needs a writable cache dir; Claude's sandbox blocks ~/.cache/uv
export UV_CACHE_DIR="${TMPDIR:-/tmp}/uv-cache"

if [[ "$file_path" == */backend/*.py ]]; then
  cd backend
  uv run ruff check "$file_path" 2>&1 || true
  uv run ruff format --check --diff "$file_path" 2>&1 || true
elif [[ "$file_path" == */frontend/*.ts ]] || [[ "$file_path" == */frontend/*.tsx ]]; then
  cd frontend && bunx eslint "$file_path" 2>&1 || true
fi

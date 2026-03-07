#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

# uv needs a writable cache dir; Claude's sandbox blocks ~/.cache/uv
export UV_CACHE_DIR="${TMPDIR:-/tmp}/uv-cache"

# Derive project root from the file path (look for backend/ or frontend/ ancestor)
project_root=""
if [[ "$file_path" == */backend/*.py ]]; then
  project_root="${file_path%%/backend/*}"
  cd "$project_root/backend" || exit 1
  uv run ruff check "$file_path" 2>&1 || true
  uv run ruff format --check --diff "$file_path" 2>&1 || true
elif [[ "$file_path" == */frontend/*.ts ]] || [[ "$file_path" == */frontend/*.tsx ]]; then
  project_root="${file_path%%/frontend/*}"
  cd "$project_root/frontend" || exit 1
  bunx eslint "$file_path" 2>&1 || true
fi

#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

if [[ "$file_path" == */backend/*.py ]]; then
  cd backend && uv run ruff check "$file_path" 2>&1 || true
elif [[ "$file_path" == */frontend/*.ts ]] || [[ "$file_path" == */frontend/*.tsx ]]; then
  cd frontend && bunx eslint "$file_path" 2>&1 || true
fi

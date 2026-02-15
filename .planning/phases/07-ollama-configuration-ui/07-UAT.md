---
status: complete
phase: 07-ollama-configuration-ui
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md]
started: 2026-02-15T16:00:00Z
updated: 2026-02-15T16:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Ollama Health Badge
expected: Navigate to Settings > Ollama tab. A health badge appears next to the "Ollama" heading. If Ollama is running: green dot, "Connected", latency, and version. If not running: red dot, "Disconnected".
result: pass

### 2. Model Selector Dropdown
expected: Below the health badge, a model selector dropdown shows locally available Ollama models. Each option displays model name and formatted size (e.g., "qwen3:8b -- 4.9 GB"). Models currently loaded in Ollama memory show a "(loaded)" indicator.
result: issue
reported: "Model name and size displayed correctly, (loaded) indicator missing. Also using native drop-down, should use ChakraUI drop-down instead."
severity: major

### 3. Separate Models Toggle
expected: When 2+ models are installed, a "Use separate models" switch appears. Toggling it on reveals two dropdowns (Categorization Model, Scoring Model) and an orange RAM warning about both models needing to fit in memory. Toggling off returns to a single dropdown.
result: pass

### 4. Save Model Configuration
expected: Change the selected model. The "Save" button becomes enabled (it was disabled when config matches server state). Click Save. A success toast "Model configuration saved" appears. The Save button becomes disabled again.
result: pass

### 5. Disconnected State
expected: With Ollama stopped/unreachable, the model dropdowns are disabled and a message "Connect to Ollama to manage models" appears. The health badge shows "Disconnected".
result: issue
reported: "Badge works correctly. Two lines of 'Connect to Ollama...' is shown. We would like a design similar to the Feeds settings page that shows a large icon with a text below it."
severity: cosmetic

### 6. System Prompts Display
expected: Below the model management section, two collapsible sections: "Categorization Prompt" and "Scoring Prompt" (collapsed by default). Clicking one expands it to show the prompt text in a read-only mono font area. Clicking again collapses it.
result: pass

### 7. Curated Model Library
expected: An "Available Models" section shows 5 curated models (qwen3:1.7b, qwen3:4b, qwen3:8b, gemma3:4b, llama3.2:3b). Each row shows name, approximate size, and description. Models already installed show a green "Installed" badge. Non-installed models show a "Pull" button.
result: pass

### 8. Custom Model Input
expected: Below the curated list, a "Custom model" text input with placeholder "e.g., mistral:7b" and a "Pull" button. Entering a model name and clicking Pull (or pressing Enter) starts a download.
result: pass

### 9. Model Pull with Progress
expected: Clicking Pull on any model starts a download. The Pull button is replaced by an inline progress bar showing percentage and download speed (e.g., "45% -- 2.3 MB/s"). Other Pull buttons are disabled during the download. (Requires actually pulling a model -- skip if not practical.)
result: issue
reported: "This works, but needs improvement. 1. Navigating to the main article page during an active download causes the progress-bar to disappear from the interface. It should remain in place until the download is complete or fails. 2. When pulling from a recommended model, the progress bar and associated metadata should be shown full-width underneath the model name row in the same way as the custom model design looks. 3. The download indicator in the settings sidebar should be a download-icon rather than a dot. 4. The design of the page when connected should more closely resemble the Feeds settings page where there are distinct panels for each of the sections: Model selection, Model management/download, System prompts. The names of these sections needs work so suggest good ones for each of them."
severity: major

### 10. Cancel Download
expected: During an active download, a Cancel button appears next to the progress bar. Clicking it stops the download and clears the progress display.
result: issue
reported: "Cancel works. Trying to pull a model that does not exist however: This shows a progress bar that completes almost instantly. It should show an error message instead saying model does not exist."
severity: major

### 11. Delete Model
expected: Installed models that are NOT the active categorization/scoring model show a trash icon button. Clicking it opens a confirmation dialog: "Delete [model name]? This will remove the model from Ollama. You can re-download it later." Confirming deletes the model and shows a success toast.
result: pass

### 12. Re-evaluate Unread Articles
expected: After saving a model configuration change, a "Re-evaluate unread articles" button becomes active. Clicking it triggers re-scoring and shows a toast like "X articles queued for re-evaluation".
result: issue
reported: "Fail. The button becomes active, but no toast is displayed and already scored, unread articles are not added to the queue again."
severity: blocker

### 13. Download Indicator on Sidebar
expected: During an active model download, the "Ollama" item in the settings sidebar shows a subtle pulsing dot indicator. The dot disappears when the download completes.
result: pass

## Summary

total: 13
passed: 8
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Models currently loaded in Ollama memory show a (loaded) indicator in the dropdown"
  status: failed
  reason: "User reported: (loaded) indicator missing"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Model selector uses Chakra UI styled dropdown instead of native select"
  status: failed
  reason: "User reported: using native drop-down, should use ChakraUI drop-down instead"
  severity: minor
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Disconnected state shows a centered empty-state design with large icon and text, matching Feeds section pattern"
  status: failed
  reason: "User reported: Two lines of 'Connect to Ollama...' shown, wants design similar to Feeds settings page with large icon and text below"
  severity: cosmetic
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Progress bar remains visible when navigating away from settings and back"
  status: failed
  reason: "User reported: Navigating to the main article page during an active download causes the progress-bar to disappear from the interface. It should remain in place until the download is complete or fails."
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Recommended model progress bar shows full-width below the model row, matching custom model layout"
  status: failed
  reason: "User reported: When pulling from a recommended model, the progress bar should be shown full-width underneath the model name row in the same way as the custom model design"
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Download indicator in settings sidebar uses a download icon rather than a dot"
  status: failed
  reason: "User reported: The download indicator in the settings sidebar should be a download-icon rather than a dot"
  severity: cosmetic
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Ollama settings page uses distinct panels for each section (matching Feeds page design) with well-named section headers"
  status: failed
  reason: "User reported: The design of the page when connected should more closely resemble the Feeds settings page with distinct panels for each section. Section names need work."
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Pulling a non-existent model shows an error message instead of a progress bar that completes instantly"
  status: failed
  reason: "User reported: Trying to pull a model that does not exist shows a progress bar that completes almost instantly. It should show an error message instead saying model does not exist."
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Re-evaluate button triggers re-scoring of unread articles with toast confirmation and articles added back to scoring queue"
  status: failed
  reason: "User reported: The button becomes active, but no toast is displayed and already scored, unread articles are not added to the queue again."
  severity: blocker
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/OllamaSection.tsx
  - frontend/src/components/settings/ModelSelector.tsx
  - frontend/src/components/settings/ModelManagement.tsx
  - frontend/src/components/settings/SystemPrompts.tsx
autonomous: true
must_haves:
  truths:
    - "When Ollama is disconnected, exactly one centered placeholder is shown (not two)"
    - "Model Library panel has two distinct sub-sections: Downloaded Models and Download Models"
    - "All sub-section headings use consistent fontSize=sm fontWeight=medium color=fg.muted styling"
    - "System Prompts panel has no redundant inner label"
  artifacts:
    - path: "frontend/src/components/settings/OllamaSection.tsx"
      provides: "Top-level disconnected gate, three connected panels"
    - path: "frontend/src/components/settings/ModelManagement.tsx"
      provides: "Split Downloaded/Download sub-sections"
    - path: "frontend/src/components/settings/SystemPrompts.tsx"
      provides: "Clean prompts without redundant label"
    - path: "frontend/src/components/settings/ModelSelector.tsx"
      provides: "No disconnected placeholder (handled by parent)"
  key_links:
    - from: "OllamaSection.tsx"
      to: "ModelSelector.tsx, ModelManagement.tsx"
      via: "isConnected prop still passed but components no longer render own disconnected states"
---

<objective>
Restructure the Ollama settings panels: consolidate the disconnected state into a single placeholder at the OllamaSection level, split the Model Library panel into "Downloaded Models" and "Download Models" sub-sections, remove the redundant label in SystemPrompts, and standardize all sub-section heading styles.

Purpose: Eliminate duplicate disconnected placeholders, improve information architecture of the model library, and achieve visual consistency across panels.
Output: Updated OllamaSection.tsx, ModelSelector.tsx, ModelManagement.tsx, SystemPrompts.tsx
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/settings/OllamaSection.tsx
@frontend/src/components/settings/ModelSelector.tsx
@frontend/src/components/settings/ModelManagement.tsx
@frontend/src/components/settings/SystemPrompts.tsx
@frontend/src/components/settings/FeedsSection.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Consolidate disconnected state and remove child placeholders</name>
  <files>
    frontend/src/components/settings/OllamaSection.tsx
    frontend/src/components/settings/ModelSelector.tsx
    frontend/src/components/settings/ModelManagement.tsx
  </files>
  <action>
In OllamaSection.tsx, add a disconnected gate AFTER the section header (Ollama heading + health badge). When `!isConnected`, render a single centered placeholder instead of the three panels. Use the same empty-state pattern as FeedsSection's empty state:

```tsx
<Flex
  direction="column"
  alignItems="center"
  justifyContent="center"
  gap={4}
  py={16}
  px={8}
  bg="bg.subtle"
  borderRadius="md"
  borderWidth="1px"
  borderColor="border.subtle"
>
  <LuServerOff size={40} color="var(--chakra-colors-fg-subtle)" />
  <Text fontSize="lg" color="fg.muted" textAlign="center">
    Ollama is not connected
  </Text>
  <Text fontSize="sm" color="fg.muted" textAlign="center">
    Start Ollama to configure models and prompts
  </Text>
</Flex>
```

Import `LuServerOff` from `react-icons/lu` in OllamaSection.tsx.

The three panel boxes should only render when `isConnected` is true. Use a simple conditional: render the disconnected placeholder OR the three panels.

In ModelSelector.tsx: Remove the entire `if (!isConnected)` early return block (lines 50-73). The component will no longer need to handle disconnected state itself. Remove the `LuServerOff` import if it becomes unused (it will be unused since the only usage was the disconnected placeholder).

In ModelManagement.tsx: Remove the entire `if (!isConnected)` early return block (lines 95-118). Remove the `LuServerOff` import from the import statement (it is only used by the disconnected block).
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` to confirm no type errors. Visually confirm only OllamaSection.tsx imports LuServerOff for the disconnected state.
  </verify>
  <done>When Ollama is disconnected, OllamaSection renders exactly one centered placeholder. ModelSelector and ModelManagement no longer have their own disconnected placeholders.</done>
</task>

<task type="auto">
  <name>Task 2: Split Model Library into Downloaded/Download sub-sections and fix SystemPrompts</name>
  <files>
    frontend/src/components/settings/ModelManagement.tsx
    frontend/src/components/settings/SystemPrompts.tsx
  </files>
  <action>
**ModelManagement.tsx** -- Restructure the connected-state return into two sub-sections. The component no longer needs to handle `!isConnected` (removed in Task 1), so the entire component body is the connected path.

Sub-section heading style (use consistently): `fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}`

**Sub-section 1: "Downloaded Models"**
- Subheading: "Downloaded Models"
- List ALL installed models together: filter `CURATED_MODELS` to only those where `installedNames.has(curated.name)`, combined with the non-curated installed models list (already at lines 212-266). Each row keeps the same layout (name, size badge if curated, "Installed" badge, delete button). Use the same `Box` with `borderBottomWidth="1px"` row pattern.
- If no models are installed, show a brief muted text: `<Text fontSize="sm" color="fg.muted">No models downloaded yet</Text>`

**Sub-section 2: "Download Models"**
- Subheading: "Download Models"
- A small intro line: `<Text fontSize="xs" color="fg.muted" mb={3}>Suggested models for article scoring:</Text>`
- List CURATED_MODELS that are NOT installed (i.e., `!installedNames.has(curated.name)`). Each row shows name, size, description, and a "Pull" button. Same row layout as current curated rows but only uninstalled ones.
- If all curated models are already installed, skip the curated list entirely (don't show the "Suggested models" intro either).
- Below the curated list (or directly if all curated are installed), show a separator: `<Text fontSize="xs" color="fg.muted" mt={2} mb={1.5}>Or download a specific model:</Text>`
- Then the custom model input (same as current lines 269-292).

Keep the pull progress, error display, and delete confirmation dialog at the bottom of the Stack as they are now (they work for both sub-sections).

Separate the two sub-sections with `<Box mt={6}>` wrapping the "Download Models" section to give visual breathing room.

**SystemPrompts.tsx** -- Remove the redundant `<Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={1}>System Prompts</Text>` on line 66-68. The panel heading in OllamaSection already says "System Prompts". The `<Stack gap={1}>` should directly contain the two `<PromptSection>` elements. Keep everything else unchanged.
  </action>
  <verify>
Run `cd /Users/cstalhem/projects/rss-reader/frontend && npx tsc --noEmit` to confirm no type errors. Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` to confirm the production build succeeds.
  </verify>
  <done>Model Library panel shows "Downloaded Models" listing all installed models and "Download Models" listing uninstalled curated models plus custom input. SystemPrompts has no redundant inner label. All sub-section headings use consistent `fontSize="sm" fontWeight="medium" color="fg.muted"` styling.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors in the settings components
- `bun run build` succeeds
- Only OllamaSection.tsx imports LuServerOff; ModelSelector.tsx and ModelManagement.tsx do not
- No duplicate disconnected placeholders in the component tree
</verification>

<success_criteria>
1. Disconnected state: Single centered placeholder in OllamaSection when Ollama is offline
2. Model Library: Two clear sub-sections with "Downloaded Models" and "Download Models" headings
3. SystemPrompts: No redundant inner "System Prompts" label
4. All sub-section headings use fontSize="sm" fontWeight="medium" color="fg.muted" consistently
</success_criteria>

<output>
After completion, create `.planning/quick/9-update-ollama-settings-panel-headings-se/9-SUMMARY.md`
</output>

# Feature Landscape: v1.1 Configuration, Feedback & Polish

**Domain:** RSS Reader LLM Configuration, User Feedback, Category Management, UI Polish
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH (HIGH for standard patterns, MEDIUM for hierarchical category weights)

## Context

v1.1 milestone focuses on four feature areas for an existing, operational RSS reader with LLM scoring:

1. **Ollama Configuration UI** — Runtime model selection, connection health, prompt visibility
2. **UI & Theme Polish** — Design refinements across the app  
3. **LLM Feedback Loop** — User signals (thumbs up/down, score adjustments) to improve scoring
4. **Category Grouping** — Hierarchical category organization with cascading weights

**Existing v1.0 features already built:**
- Article list with score badges, read/unread state, load-more pagination
- LLM two-step pipeline (categorize → score) with flat category tags
- Settings page with prose preferences and per-category weights
- Feed management (add/remove/rename/reorder)
- Dark/light theme with orange accent

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Ollama Connection Health Check** | Users need to know if LLM is reachable before expecting scoring to work | Low | Standard pattern: ping endpoint with timeout, display status indicator (green/yellow/red) |
| **Model Selection Dropdown** | Runtime model switching is table stakes in LLM UIs vs editing config files manually | Low | List available models via Ollama API `/api/tags`, persist selection in DB |
| **Basic Thumbs Up/Down Feedback** | Minimal friction feedback is standard in content apps — users expect quick signal mechanism | Low | Single API call on click, persist to DB, visual acknowledgment (toast/icon change) |
| **Flat Category List Display** | Users need to see what categories exist before hierarchical organization makes sense | Low | Already exists — current category tag chips in Settings |
| **Read State Persistence** | Feedback mechanisms must respect that article was already read/scored | Low | Already exists — `is_read` field in Article model |
| **Visual Feedback on Action** | Users expect immediate UI response to clicks (loading states, success confirmation) | Low | Toast notifications, button state changes, skeleton loaders during API calls |
| **Error Messages for Config Failures** | If model doesn't exist or connection fails, user must know why | Low | Try-catch around Ollama calls, surface human-readable errors in UI (not just console logs) |

---

## Differentiators

Features that set product apart or exceed base expectations. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Live Prompt Visibility** | Power users want to see/understand what prompts are sent to LLM | Medium | Display system prompts in expandable section, show actual prompt text with variable substitution |
| **Hierarchical Category Groups** | Enables topic-based organization (e.g., "Tech" parent with "AI", "DevOps" children), reduces clutter | Medium | Requires parent-child relationships, cascading weight calculation, conflict resolution rules |
| **Cascading Weight Inheritance** | Parent weight applies to all children unless overridden — reduces configuration burden | Medium | Weight resolution algorithm: local override > parent weight > default (1.0) |
| **Per-Category Weight Overrides** | Fine-grained control: "Tech=2.0 but Tech>AI=0.5" for specific interests within broader topic | Medium | Requires conflict resolution: proximity (closer parent wins) > recency > default |
| **Explicit Score Adjustment UI** | User can directly modify article score (e.g., "this 15 should be 5") as strong signal | Medium | Stores user_adjusted_score, flags article for feedback training, recalculates display score |
| **Feedback-Driven Re-scoring** | Articles with feedback trigger category weight adjustments over time (learning loop) | High | Requires feedback aggregation, weight adjustment algorithm, gradual convergence strategy, careful tuning |
| **Model Parameter Visibility** | Show current model's context window, parameter count, memory usage in config UI | Medium | Query Ollama `/api/show` endpoint for model details, display technical specs |
| **Prompt Template Editing** | Advanced: let user customize system prompts for categorization/scoring | High | Dangerous — bad prompts break scoring; needs validation, preview, rollback mechanism |
| **Batch Re-score with New Config** | After changing model/weights, user can trigger re-scoring of existing articles | Medium | Background job to reset scoring_state='queued' for filtered articles, progress indicator |
| **Category Merge/Rename Tools** | LLM might create "machine-learning" and "ml" — user needs consolidation tools | Medium | Reassign articles, update weights, handle conflicts, transaction safety |
| **Smooth Animations & Transitions** | Polish: micro-interactions, state transitions, loading states feel fluid | Low | Chakra UI provides animation primitives, apply consistently across UI |
| **Responsive Breakpoints** | Mobile-friendly config UI, collapsible sections, touch-friendly feedback buttons | Low | Chakra responsive props already in use, extend to new components |

---

## Anti-Features

Features to explicitly NOT build (or defer significantly).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full RLHF Training Pipeline** | Requires 1000s of samples, reward model training, RL infrastructure — overkill for personal app | Use simpler direct weight adjustment: thumbs down → reduce category weights proportionally |
| **Real-Time Model Switching Mid-Scoring** | Ollama model switches are expensive (unload/load cycles), causes inconsistent scoring batches | Require user to pause scoring queue before model change, show warning dialog |
| **Automatic Model Downloads** | Large downloads (4-30GB) without user consent feels invasive, can fill disk unexpectedly | Show available local models only; provide link to Ollama CLI instructions for pulling new models |
| **Multi-Model Ensemble Scoring** | Running multiple models per article for voting/consensus is 3-5x slower, complex aggregation logic | Single model per function (categorization, scoring) is sufficient for personal use |
| **Category Auto-Merge via Similarity** | LLM-based semantic similarity to auto-merge "AI" and "artificial-intelligence" adds uncertainty | Manual merge tools with preview — user stays in control of taxonomy |
| **Live Prompt Editing During Scoring** | Changing prompts mid-batch causes inconsistent results, hard to debug scoring issues | Require scoring queue pause, show "changes take effect on next batch" warning |
| **Feedback Undo/History UI** | Tracking full feedback history adds complexity; users rarely need audit trail for personal app | Allow re-voting (overwrite previous feedback); no detailed history UI needed |
| **Per-Article Model Selection** | "Score this article with llama3, that one with qwen" is micro-optimization hell | Global model selection only; edge case not worth the UI/backend complexity |
| **Category Hierarchy Depth >2 Levels** | "Tech > AI > LLMs > GPT-4 > Prompt Engineering" becomes unwieldy for weight calculation | Limit to parent-child (2 levels max); keep children flat under parent |

---

## Feature Dependencies

```
Ollama Connection Health Check
  → Model Selection Dropdown (need connection to list models)
  → Prompt Visibility (need connection to show active config)

Basic Category Display (exists in v1.0)
  → Hierarchical Category Groups (builds on existing flat list)
  → Per-Category Weight Overrides (requires hierarchy to have overrides)
  → Category Merge/Rename Tools (operates on category data)

Basic Thumbs Up/Down Feedback
  → Explicit Score Adjustment UI (builds on feedback mechanism)
  → Feedback-Driven Re-scoring (requires collected feedback data)

Hierarchical Category Groups
  → Cascading Weight Inheritance (requires parent-child structure)
  → Per-Category Weight Overrides (requires hierarchy for override concept)
```

---

## MVP Recommendation

Based on milestone goals and existing v1.0 infrastructure, prioritize features by value and dependencies:

### Phase 1: Ollama Configuration UI (High Value, No Dependencies)

**Why first:** Independent feature, unblocks user control over LLM without schema changes (JSON column), high user-facing value.

1. **Connection Health Check** — ping Ollama, display status indicator (green/yellow/red)
2. **Model Selection Dropdown** — list via `/api/tags`, persist to `UserPreferences.ollama_config` JSON field
3. **Model Parameter Display** — show context window, parameter count from `/api/show`
4. **Prompt Visibility (Read-Only)** — display system prompts in expandable sections in Settings

**Complexity:** Low-Medium (mostly UI work, minimal backend changes)

---

### Phase 2: LLM Feedback Loop (Medium Complexity, Foundation for Learning)

**Why second:** Immediate user value (signal mechanism), starts data collection for future improvements. Build simple version first.

1. **Basic Thumbs Up/Down UI** — buttons on article cards/reader, persist to `Article.user_feedback` JSON field
2. **Explicit Score Adjustment** — input/slider to override composite_score, persist to `Article.user_adjusted_score`
3. **Feedback Aggregation Endpoint** — API to query feedback patterns by category (for manual analysis)
4. **Simple Weight Suggestion** — after N feedbacks per category, show suggested weight changes in Settings UI

**Complexity:** Medium (UI work + modest backend logic, defer complex re-scoring algorithms)

---

### Phase 3: Category Grouping (High Complexity, Requires Schema Work)

**Why third:** Most complex feature (schema migration, conflict resolution, UI redesign). Build after simpler features validate approach.

1. **Category Hierarchy Schema** — new `CategoryGroup` table with `parent_id`, `weight`, `display_order` fields
2. **Hierarchical Display UI** — nested category list with expand/collapse, indentation visual hierarchy
3. **Cascading Weight Calculation** — algorithm: `effective_weight = local_override ?? parent_weight ?? 1.0`
4. **Per-Category Override UI** — weight input field per category in hierarchical Settings view
5. **Migration Strategy** — convert existing flat `topic_weights` dict to hierarchical structure (all top-level initially)

**Complexity:** High (schema design, migration, conflict resolution rules, scoring formula changes)

---

### Phase 4: UI Polish (Continuous Throughout)

**Why throughout:** Polish is not a discrete phase but applied incrementally during other phases. Each feature should ship polished.

1. **Loading States** — skeleton loaders during Ollama API calls, feedback submission, model list fetching
2. **Error Handling** — toast notifications for connection failures, invalid model selections, feedback errors
3. **Empty States** — "No feedback yet" placeholders, "Connect Ollama to begin" prompts, "No categories defined" messages
4. **Responsive Design** — mobile-friendly model selection, collapsible prompt displays, touch-friendly feedback buttons
5. **Micro-interactions** — smooth transitions on thumbs up/down, success animations on save, hover states

**Complexity:** Low per item, but cumulative attention to detail across all features

---

## Defer to Later Milestones

| Feature | Why Defer | Earliest Milestone |
|---------|-----------|-------------------|
| **Prompt Template Editing** | Dangerous (bad prompts break scoring), requires validation/preview/rollback; low initial demand | v1.2+ |
| **Batch Re-score with New Config** | Useful but not critical; users can wait for new articles to use updated config | v1.2 |
| **Feedback-Driven Auto-Adjustment** | Requires significant data collection first (50+ feedbacks); build manual tools first | v1.3+ |
| **Category Merge/Rename Tools** | Solves problem that may not exist yet (category explosion); wait for real user need | v1.2 |
| **RLHF-Style Training** | Over-engineered for personal app; simpler weight adjustment sufficient for this use case | Never (anti-feature) |
| **Advanced Animations** | Nice-to-have polish; focus on functional animations (loading, success) first | v1.2+ |

---

## Implementation Notes

### Ollama Model Selection Architecture

- **Model List Fetching:** `GET http://ollama:11434/api/tags` returns JSON with all local models
- **Model Details:** `POST http://ollama:11434/api/show` with `{"name": "qwen3:8b"}` returns full config/parameters
- **Storage:** Add `ollama_config` JSON field to `UserPreferences` table (avoids Settings `@lru_cache` invalidation issues)
  ```python
  ollama_config: dict = {
    "categorization_model": "qwen3:8b",
    "scoring_model": "qwen3:8b", 
    "temperature": 0.8,
    "num_ctx": 2048
  }
  ```
- **Validation:** Check model exists in local list before saving; fall back to previous model on error, surface error to user

### Feedback Storage Strategy

**Recommended: Minimal schema changes via JSON columns in existing `Article` table**

- `user_feedback`: JSON field `{"type": "thumbs_up|thumbs_down|score_adjustment", "value": float | null, "timestamp": ISO8601}`
- `user_adjusted_score`: `float | null` (overrides composite_score in display if set)

**Benefits:**
- No new tables, minimal migration
- JSON flexibility for future feedback types
- Easy to query for aggregation
- Article-centric (feedback tied to article lifecycle)

**Query Pattern:** 
```python
# Aggregate feedback by category
feedback_by_category = db.query(
    Article.categories, 
    Article.user_feedback
).filter(
    Article.user_feedback.isnot(None)
).all()
# Process to suggest weight changes
```

### Category Hierarchy Conflict Resolution

**Follow Bloomreach pattern:** [link](https://documentation.bloomreach.com/discovery/docs/conflict-resolution-for-category-facet-inheritance)

1. **Local customization wins** — child's explicit weight overrides inherited parent weight
2. **Proximity wins** — closer parent (1 level away) beats distant parent (2+ levels away)
3. **Recency wins** — most recently edited parent weight wins if tie at same level
4. **Default fallback** — if no weights set anywhere in ancestry, use 1.0

**Algorithm:**
```python
def get_effective_weight(category_id: int) -> float:
    category = get_category(category_id)
    
    # 1. Check local override
    if category.weight_override is not None:
        return category.weight_override
    
    # 2. Check parent weight (1 level up)
    if category.parent_id:
        parent = get_category(category.parent_id)
        if parent.weight is not None:
            return parent.weight
    
    # 3. Default
    return 1.0
```

### Cold Start Problem Mitigation

**New User (no feedback yet):**
- Pre-populate default category weights based on interests prose (use LLM to suggest initial weights from user's text description)
- Show onboarding tooltip: "Thumbs up/down helps improve scoring over time"

**New Category (LLM creates new tag):**
- Default weight 1.0 (neutral scoring impact)
- Surface new categories in Settings UI with "New" badge for user review
- Optional: notify user "Found 3 new categories in recent articles"

**Zero Feedback State:**
- After 10+ scored articles with no feedback, show gentle prompt: "Help improve scoring by giving feedback"
- Don't block or nag — feedback should be optional, not required

---

## Complexity Assessment

| Feature | Backend | Frontend | Database | Total Complexity |
|---------|---------|----------|----------|------------------|
| Connection Health Check | Low | Low | None | **Low** |
| Model Selection | Low | Low | Low (JSON) | **Low** |
| Prompt Visibility | Low | Medium | None | **Low-Medium** |
| Thumbs Up/Down | Low | Low | Low (JSON) | **Low** |
| Score Adjustment UI | Low | Medium | Low (JSON) | **Medium** |
| Feedback Aggregation | Medium | Low | None | **Medium** |
| Category Hierarchy Schema | High | Medium | High (new table + migration) | **High** |
| Cascading Weights | High | Low | Medium | **High** |
| Weight Override UI | Medium | High | Low | **High** |
| Batch Re-score | Medium | Medium | None | **Medium** |
| UI Polish (per item) | Low | Low-Medium | None | **Low** |

**Overall v1.1 Complexity:** Medium-High (driven by Category Hierarchy feature; other features are Low-Medium individually)

---

## Sources

### Ollama Configuration Patterns
- [Ollama Modelfile Reference](https://docs.ollama.com/modelfile) — Official docs for model parameters and configuration (HIGH confidence)
- [Understanding Ollama Configuration](https://techdocs.broadcom.com/us/en/vmware-tanzu/platform/ai-services/10-0/ai/explanation-understanding-ollama-configuration.html) — Runtime parameter configuration patterns (MEDIUM confidence)
- [Ollama Guide: Model Selection & UI](https://www.kevnu.com/en/posts/ollama-guide-local-running-model-selection-ui-enhancements-and-copilot-alternatives) — UI patterns for model switching in Ollama clients (MEDIUM confidence)
- [Choosing Ollama Models 2025 Guide](https://collabnix.com/choosing-ollama-models-the-complete-2025-guide-for-developers-and-enterprises/) — Model selection best practices and considerations (MEDIUM confidence)

### User Feedback Mechanisms
- [5 Stars vs Thumbs Up/Down Rating Systems](https://www.appcues.com/blog/rating-system-ux-star-thumbs) — UX research on feedback collection patterns (HIGH confidence)
- [User Feedback in RAG Systems](https://apxml.com/courses/optimizing-rag-for-production/chapter-6-advanced-rag-evaluation-monitoring/user-feedback-rag-improvement) — Continuous improvement loops for LLM systems (MEDIUM confidence)
- [Thumbs Up/Down Surveys](https://www.zonkafeedback.com/blog/collecting-feedback-with-thumbs-up-thumbs-down-survey) — Best practices for actionable feedback collection (MEDIUM confidence)
- [Langfuse User Feedback Collection](https://langfuse.com/docs/scores/user-feedback) — LLM-specific feedback implementation patterns (HIGH confidence)
- [Facebook Reels RecSys User Feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/) — Real-world case study: 59.5%→71.5% accuracy improvement via user feedback (HIGH confidence)

### Hierarchical Categorization
- [RSS Category Element Spec](https://www.w3schools.com/xml/rss_tag_category_item.asp) — RSS standard supports hierarchical categories natively (HIGH confidence)
- [PhotoStructure Hierarchical Tags](https://photostructure.com/faq/whats-a-hierarchical-tag/) — Practical hierarchical tag system implementation (MEDIUM confidence)
- [Extracting Tag Hierarchies](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0084133) — Academic research on tag hierarchy extraction methods (MEDIUM confidence)
- [Bloomreach Category Facet Inheritance](https://documentation.bloomreach.com/discovery/docs/conflict-resolution-for-category-facet-inheritance) — Production-tested conflict resolution patterns for hierarchies (HIGH confidence)
- [Trilium Attribute System](https://deepwiki.com/zadam/trilium/3.3-attribute-system) — Hierarchical attribute inheritance patterns in note-taking app (MEDIUM confidence)

### RLHF and Feedback Loops
- [Reinforcement Learning from Human Feedback — Wikipedia](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback) — Core RLHF concepts and background (HIGH confidence)
- [What is RLHF? — IBM](https://www.ibm.com/think/topics/rlhf) — Technical overview, requirements, and trade-offs (HIGH confidence)
- [RLHF Explained — Hugging Face](https://huggingface.co/blog/rlhf) — Practical implementation patterns and examples (HIGH confidence)
- [Cold Start Problem in Recommender Systems](https://www.freecodecamp.org/news/cold-start-problem-in-recommender-systems/) — New user/item challenges and solutions (HIGH confidence)
- [Solving Cold Start in Collaborative Filtering](https://www.tredence.com/blog/solving-the-cold-start-problem-in-collaborative-recommender-systems) — Specific mitigation strategies (MEDIUM confidence)

### LLM Model Switching Challenges
- [LLM Switching Framework](https://deepwiki.com/pipecat-ai/pipecat-flows/5.2-llm-switching) — Technical implementation patterns and gotchas (MEDIUM confidence)
- [Switching LLM Providers: Why It's Harder Than It Seems](https://www.requesty.ai/blog/switching-llm-providers-why-it-s-harder-than-it-seems) — Common pitfalls and challenges (MEDIUM confidence)

### UI/UX Polish Patterns (2026)
- [UI Design Trends 2026](https://landdding.com/blog/ui-design-trends-2026) — Modern UI patterns and user expectations (MEDIUM confidence)
- [Dark Mode Design Best Practices 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/) — Dark mode implementation guidelines, contrast ratios, typography (MEDIUM confidence)
- [RSS Reader UI Design Principles](https://www.feedviewer.app/answers/rss-reader-user-interface-design-principles) — Domain-specific UI patterns (LOW confidence — marketing content)

### Content Recommendation Systems
- [AI Content Recommendation Systems](https://www.forasoft.com/blog/article/ai-content-recommendation-systems) — Real-time feedback integration and score adjustment patterns (MEDIUM confidence)
- [Content-Based Filtering — Google ML](https://developers.google.com/machine-learning/recommendation/content-based/basics) — Recommendation system fundamentals (HIGH confidence — official Google docs)

---

*Feature research for: RSS Reader v1.1 Milestone — Configuration, Feedback & Polish*
*Researched: 2026-02-14 | Confidence: MEDIUM-HIGH*

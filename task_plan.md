# Task Plan: Sequentially Implement Requested Product Features

## Goal
Implement the 8 requested features in order, shipping each in a working state without regressing current gallery/upload/detail behavior.

## Current Phase
Phase 10 (complete)

## Phases
### Phase 1: Discovery and sequencing
- [x] Confirm requested feature order
- [x] Inspect current architecture and entry points
- [x] Prepare file-based execution plan
- **Status:** complete

### Phase 2: Feature 1 - Favorites and filtering
- [x] Add favorite/tag/filter data model support
- [x] Build filter UI and wire list querying
- [x] Add detail actions for favorite/tag editing
- [x] Verify end-to-end behavior
- **Status:** complete

### Phase 3: Feature 2 - Smart search
- [x] Implement unified index/search pipeline (OCR + EXIF + description)
- [x] Add search UX and highlight/feedback
- [x] Verify ranking and performance
- **Status:** complete

### Phase 4: Feature 3 - Map view
- [x] Add map projection data + privacy handling
- [x] Build map/timeline linked view
- [x] Verify coordinate safety rules
- **Status:** complete

### Phase 5: Feature 4 - Compare mode
- [x] Add compare selection flow
- [x] Implement side-by-side and slider mode
- [x] Verify responsive/gesture behavior
- **Status:** complete

### Phase 6: Feature 5 - Batch operations
- [x] Add multi-select state and batch toolbar
- [x] Implement batch delete/tag/download actions
- [x] Verify destructive action safeguards
- **Status:** complete

### Phase 7: Feature 6 - Detail enhancements
- [x] Add reverse close transition
- [x] Add keyboard navigation
- [x] Verify accessibility and interaction conflicts
- **Status:** complete

### Phase 8: Feature 7 - Upload reliability
- [x] Add retry/recovery queue behavior
- [x] Add resumable strategy (or best-effort fallback)
- [x] Verify failure scenarios
- **Status:** complete

### Phase 9: Feature 8 - Share links
- [x] Implement expiring-share and access policy
- [x] Add watermark preview/public-private controls
- [x] Verify security boundary
- **Status:** complete

### Phase 10: Final verification and delivery
- [x] Run typecheck/build and targeted validation
- [x] Summarize changes and residual risks
- **Status:** complete

## Key Questions
1. Favorites/tags persisted locally in current implementation; server sync remains optional next step.
2. Filter/search/map currently not encoded to URL state.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with Feature 1 fully before Feature 2 | User requested strict sequential implementation |
| Use planning-with-files workflow | Task is large and multi-phase |
| Implement MVP for all 8 features in one pass | Faster delivery while preserving extension points |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `sed` path for skill file not found in workspace | 1 | Read skill from absolute path `/Users/bytedance/.codex/skills/...` |

## Notes
- Keep each feature shippable before moving to next.
- If scope explodes, prioritize MVP with extension points.

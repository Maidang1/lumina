# Findings & Decisions

## Requirements
- Implement previously proposed 8 features in strict order.
- Start from current route-based detail overlay and existing gallery architecture.
- Maintain existing behavior while adding new capabilities incrementally.

## Research Findings
- Current detail view is already `Dialog` overlay driven by route (`/photos/:id`).
- Current codebase has no favorite/tag/filter subsystem in photo types/UI.
- Data currently comes from `uploadService.listAllImages` and mapped by `metadataToPhoto`.
- EXIF schema exposed to frontend intentionally drops GPS by default; map view must tolerate missing coordinates.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Build Feature 1 using local persisted state first | Existing backend schema/endpoints for mutable metadata are limited; local-first is low risk and fast to ship |
| Keep filter state inside `GalleryShell` and derive filtered list | Centralized state avoids cross-component sync issues |
| Implement smart search on client side with weighted token scoring | No backend index API exists; local scoring reuses OCR/EXIF/description immediately |
| Implement share-link MVP client-side | Current backend lacks signed-share endpoint; UI flow can be validated now |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Skill file not found at workspace-relative path | Used absolute path from AGENTS skill list |
| `typecheck` occasionally fails after concurrent `build` due `dist` hash file churn | Run `typecheck` after `build` sequentially |

## Resources
- `/Users/bytedance/codes/myself/lumina/src/app/App.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/components/PhotoGrid.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/components/PhotoDetail.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/services/photoMapper.ts`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/components/PhotoFilters.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/components/PhotoMapView.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/components/PhotoComparePanel.tsx`
- `/Users/bytedance/codes/myself/lumina/src/features/photos/services/photoSearch.ts`

## Visual/Browser Findings
- N/A for this phase (no browser/image inspection yet).

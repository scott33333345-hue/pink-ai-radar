# Product Design QA — Step 5 Trust

## Evidence

- Visual source: `docs/design-references/selected-card-detail-option-2.png`
- Accepted list baseline: `docs/step-4-discovery/discovery-final.png`
- Full implementation: `docs/step-5-trust/trust-method-full.png`
- Detail implementation: `docs/step-5-trust/trust-detail-final.png`
- Viewports: 1440 × 4200 and 1440 × 1000 CSS px, device scale 1.
- States: full briefing list, source link actions, first article detail.

## Findings

- No remaining P0/P1/P2 visual or interaction issue in the Step 5 trust surfaces.
- “查看完整判断”和“官方原文”形成明确的主次双出口。
- 来源等级、原文标题、评级理由和核验时间在详情页集中呈现。
- 五步工作流与 AI/人工责任边界保持原有编辑型视觉语言，没有抢夺资讯主体层级。

## Required fidelity surfaces

- Typography: inherited display and body typography; evidence metadata uses a smaller but readable hierarchy.
- Spacing/layout: source actions align with card footers; long evidence fields use vertical layout.
- Colors/tokens: trust UI reuses existing pink, plum, cream, line and semantic grade colors.
- Image quality: accepted lead image remains unchanged; no new decorative asset was introduced.
- Copy/content: labels state source type and responsibility without claiming that AI performs final verification.

## Interaction checks

- Official-source links open the exact original page in a new tab.
- Clicking an official-source link does not also open the article dialog.
- Article detail keeps the official source available after reading the interpretation.
- Existing search, filtering, dialog close and keyboard-open paths remain present.

## Comparison history

1. P2: long source titles and rating reasons inherited the short-field two-column layout. Fixed by stacking the first two evidence fields.
2. P2: the initial source-section anchor capture was blank in Edge headless. Replaced with a full-page rendered capture that visibly includes the workflow and responsibility boundary.
3. Post-fix evidence: `trust-detail-final.png` and `trust-method-full.png`.

Focused detail comparison was required because the source-evidence typography was too small to judge in the full-page capture.

final result: passed

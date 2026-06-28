---
name: ce-doc-review
description: "Review Compound Engineering markdown plan documents for coherence, feasibility, scope alignment, and safe markdown-only fixes. Use headless mode for automated plan handoff review."
argument-hint: "[mode:headless] <markdown-plan-path>"
---

# CE Document Review

Review a Compound Engineering markdown plan or requirements document. This skill is intentionally markdown-only: do not mutate HTML artifacts. If the target is HTML, missing, or not a CE plan/requirements document, report a non-blocking skip with notes.

## Modes

- `mode:headless <path>`: run an automated advisory pass, apply only safe markdown fixes, and return a concise review envelope.
- `<path>` without `mode:headless`: run the same review, but include actionable findings clearly enough for an interactive caller to decide what to apply.

## Review boundary

`ce-brainstorm` owns WHAT: product requirements, actors, flows, acceptance examples, and scope boundaries.

`ce-plan` owns HOW: technical decisions, implementation units, dependencies, risks, verification contract, and handoff posture.

`ce-doc-review` checks whether the document preserves that boundary and is usable by downstream `ce-work`, PR reviewers, and humans. Do not turn document review into code review; `ce-code-review` owns implementation diff review later in the pipeline.

## Procedure

1. Resolve the target path from the arguments. Prefer an explicit path. If no path is provided, inspect `docs/plans/` for the most recent markdown plan-like artifact and use that; if none exists, skip non-blockingly.
2. Confirm the target is markdown (`.md`). If it is not markdown, skip and explain that HTML document review is not supported yet.
3. Read the document enough to evaluate structure and consistency. For long documents, scan headings first, then read the Goal Capsule/Product Contract/Plan/Implementation Units/Verification/Definition of Done sections as present.
4. Check for:
   - Product scope drift: requirements or Product Contract rewritten without a clear preservation note.
   - HOW gaps: implementation units lacking files, dependencies, risks, or verification scenarios.
   - Coherence gaps: contradictory decisions, stale handoff instructions, duplicated or inconsistent artifact readiness metadata.
   - Feasibility gaps: sequencing that cannot work, missing prerequisite decisions, or verification that cannot prove the stated Definition of Done.
   - Markdown-only hygiene that is safe to fix automatically: broken heading levels, obvious duplicate blank lines, malformed checklists, or typo-level wording that does not change meaning.
5. In headless mode, apply only `safe_auto` fixes directly to the markdown file. Do not apply changes that alter product scope, technical decisions, acceptance criteria, or verification obligations; report those as findings.
6. If findings remain, classify each as:
   - `proposed_fix`: a safe but non-trivial improvement the user may accept.
   - `decision`: a scope/technical judgment that needs human or planner choice.
   - `fyi`: useful observation that does not need routing.
7. End with a concise summary and exactly one trailing JSON object on the final line.

## Output contract

Use this shape for the final line:

```json
{"verdict":"APPROVE|APPROVE_WITH_NOTES|REVISE","fixes_applied":0,"proposed_fixes_count":0,"decisions_count":0,"fyi_count":0,"notes":"short summary"}
```

- `APPROVE`: no actionable issues remain.
- `APPROVE_WITH_NOTES`: non-blocking observations or skipped review; this is the normal result for optional workflow use.
- `REVISE`: only for severe document issues that make downstream work unsafe or impossible. In the Fusion built-in workflow this skill is advisory/non-blocking, but the verdict still helps humans see severity.

Do not wrap the final JSON in markdown fences.

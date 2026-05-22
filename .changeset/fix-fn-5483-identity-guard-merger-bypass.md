---
"@runfusion/fusion": patch
---

fix(FN-5483): allow merger-driven commits past the identity-guard pre-commit hook (detached HEAD false-positive).

The reuse-task-worktree merge path intentionally detaches HEAD at the integration target before running squash and verification-fix ceremonies. The identity-guard hook (`buildIdentityGuardHook`) refused every such commit because `HEAD_BRANCH=detached` never matches the owning task branch, surfacing as `merge-deadlock-detected: requires manual intervention — verified content not on main` on FN-5441 and FN-5446.

The hook now honors a `FUSION_MERGER_BYPASS_IDENTITY_GUARD=1` env-var bypass (gated to the exact value `"1"`), set only on merger-driven `git commit` calls. The marker is placed after the `TASK_FILE` check so non-fusion worktrees stay no-op, and before `EXPECTED_BRANCH` so detached HEAD never reaches the refusal printf. Agent commits never set this env, so the guard still catches executor/reviewer misuse. `buildCommitMsgTrailerHook` and `buildPrepareCommitMsgEmptyGuardHook` are unchanged and continue to run on every merger commit, preserving FN-5089 trailer attribution and FN-5345/FN-5377 empty-commit refusal.

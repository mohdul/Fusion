---
"fusion-workspace": patch
---

chore(test-isolation): detect live engine via lock-held marker instead of timing probe

`scripts/check-test-isolation.mjs` previously relied on a 2-second post-test mutability probe to distinguish "tests wrote `.fusion/`" from "the local dashboard is running and writing `.fusion/`". When the engine's heartbeat happened to land outside the probe window, the script flagged the user's live engine as a test pollution violation and failed `pnpm test:full` with exit 1 despite every test suite passing.

Now the script first checks for `engine.lock.lock/` (the proper-lockfile directory the engine creates while holding the singleton lock). When present, the `.fusion` dir is auto-marked externally-active and skipped from violation reporting — race-free, no timing window. The mutability probe is retained as a backstop for dirs without a live lock but with another external writer.

Also added `engine.lock` and `engine.lock.lock/` to `RUNTIME_IGNORE_PATTERNS` so a mid-test engine start/stop doesn't trip the signature comparison on its own.

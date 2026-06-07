---
"@runfusion/fusion": patch
---

Make `fn_goal_list` and `fn_goal_show` available in engine agent sessions, including executor, heartbeat, and triage runs.

Also make `fn_goal_list` output concise by truncating descriptions to short single-line snippets while keeping full goal descriptions available through `fn_goal_show`.

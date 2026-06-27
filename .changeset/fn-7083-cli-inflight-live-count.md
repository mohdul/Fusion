---
"@runfusion/fusion": patch
---

summary: fn project list/info now show live running-agent counts from in-progress tasks.
category: fix
dev: CLI In-Flight Agents derives from `column === "in-progress"` task counts, mirroring FN-7080's dashboard route; persisted `projectHealth.inFlightAgentCount` and slot semantics are unchanged.

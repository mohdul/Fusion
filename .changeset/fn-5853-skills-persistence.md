---
"@runfusion/fusion": patch
---

Fix the dashboard skills interface so enabled and disabled skill toggles persist across refreshes for both top-level and package-scoped skills. The adapter now normalizes stored skill paths consistently when writing settings and when rediscovering installed skills.

---
"@runfusion/fusion": patch
---

Ensure bundled Droid CLI provider startup registers without waiting for local `droid` probes and harden binary probes so missing, guarded, or hanging spawns resolve to unavailable sentinels instead of delaying engine boot.

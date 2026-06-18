---
"@runfusion/fusion": patch
---

Fix mobile terminal font measurement by keeping the symbols-only Nerd Font out of xterm's measured ASCII font stack while retaining a scoped DOM glyph fallback.

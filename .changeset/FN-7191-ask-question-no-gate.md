---
"@runfusion/fusion": patch
---

summary: Permanent agents can ask the user a question directly without an approval gate.
category: fix
dev: Classify fn_ask_question in COORDINATION_EXEMPT_TOOLS and READONLY_FN_TOOLS (gating-classifications.ts) so both the permanent-agent gate and action gate auto-allow it, mirroring fn_send_message.

---
"@runfusion/fusion": minor
---

Make the built-in compound-engineering workflow run the CE way end-to-end. The execute stage now invokes the `compound-engineering:ce-work` skill in coding mode instead of the generic executor prompt, so implementation follows the compound-engineering workflow. (Further stages — CE commit/PR merge flow, human-in-the-loop planning questions, and subagent enablement — land in follow-up commits on this feature.)

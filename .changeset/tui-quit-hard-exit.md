---
"@runfusion/fusion": patch
---

summary: Pressing q (or Ctrl+C) in the TUI now quits cleanly without engine logs bleeding onto your shell.
category: fix
dev: Two-part fix. (1) dashboard.ts shutdown/devShutdown arm an unref'd 3s hard-exit watchdog on the first signal and force an immediate process.exit(0) on a second signal, so a hung stopAllDevServers/engine/central-core teardown can no longer leave the process alive. (2) Root cause of the "TUI keeps rendering after q" symptom: dispose() called logSink.releaseConsole() (re-pointing console.* at the terminal) before tui.stop() restored the shell, so slow engine/mesh/dev-server teardown logs painted over the recovered prompt. dispose() now calls the new logSink.silence() instead, dropping all sink + console.* output from quit to exit. Shutdown step diagnostics (timeShutdownStep + the watchdog stall line) are gated behind FUSION_DEBUG_SHUTDOWN=1 so a normal quit is pristine.

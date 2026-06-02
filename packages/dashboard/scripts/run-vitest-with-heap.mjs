#!/usr/bin/env node
/* global clearInterval, console, process, setInterval */

import { spawn } from "node:child_process";
const rawArgs = process.argv.slice(2);
const heapArg = rawArgs.find((arg) => arg.startsWith("--heap="));
const heapMb = heapArg?.slice("--heap=".length) || "6144";
const vitestArgs = rawArgs.filter((arg) => !arg.startsWith("--heap="));

if (vitestArgs.length === 0) {
  console.error("Usage: node scripts/run-vitest-with-heap.mjs [--heap=6144] <vitest args...>");
  process.exit(1);
}

const nodeOptions = [`--max-old-space-size=${heapMb}`, process.env.NODE_OPTIONS || ""]
  .join(" ")
  .trim();
const child = spawn("pnpm", ["exec", "vitest", ...vitestArgs], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

const heartbeat = setInterval(() => {
  console.log(`[dashboard-vitest] still running: ${vitestArgs.join(" ")}`);
}, 5_000);

const forwardSignal = (signal) => {
  child.kill(signal);
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("close", (code, signal) => {
  clearInterval(heartbeat);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

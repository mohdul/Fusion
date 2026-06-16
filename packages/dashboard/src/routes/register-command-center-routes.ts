import {
  aggregateTokenAnalytics,
  aggregateToolAnalytics,
  aggregateActivityAnalytics,
  aggregateProductivityAnalytics,
  composeLiveSnapshot,
  type TokenGroupBy,
} from "@fusion/core";
import type { Request } from "express";
import { ApiError } from "../api-error.js";
import type { ApiRouteRegistrar } from "./types.js";

/**
 * Command Center analytics API (U9).
 *
 * Thin HTTP adapters over the Phase-A core aggregators
 * (`{token,tool,activity,productivity}-analytics.ts`) and the U6a live-snapshot
 * composer (`command-center-live.ts`). All metric math lives in `@fusion/core`
 * (KTD2); these handlers only parse the request, resolve the **project-scoped**
 * store, and serialize the aggregator output.
 *
 * Security:
 *  - Every route inherits the dashboard's standard session/auth middleware via
 *    the {@link ApiRouteRegistrar} contract — exactly like `register-usage-routes.ts`.
 *    No analytics endpoint, including `/live`, is unauthenticated; an
 *    unauthenticated request is rejected with 401 by the server-level auth
 *    middleware before reaching these handlers.
 *  - Every endpoint (JSON and `/live`) resolves the database through
 *    `getScopedStore(req)` before aggregating, so a project-A caller can never
 *    read project-B data.
 *
 * Robustness:
 *  - Missing or invalid `from`/`to`/`groupBy` query params fall back to a
 *    documented default window (the last {@link DEFAULT_WINDOW_DAYS} days) and a
 *    no-grouping default — never a 500. See {@link resolveRange}.
 */

/** Documented default analytics window when range params are absent/invalid. */
export const DEFAULT_WINDOW_DAYS = 7;

const VALID_GROUP_BY: ReadonlySet<string> = new Set<TokenGroupBy>([
  "model",
  "provider",
  "node",
  "agent",
]);

/** A resolved, always-valid `[from, to]` ISO range. */
export interface ResolvedRange {
  from: string;
  to: string;
  /** True when the caller's params were missing/invalid and the default applied. */
  defaulted: boolean;
}

function isValidIso(value: string): boolean {
  const t = Date.parse(value);
  return Number.isFinite(t);
}

/**
 * Resolve `from`/`to` query params into an always-valid ISO range.
 *
 * Both bounds must be present, parseable, and ordered (`from <= to`); otherwise
 * the documented default window (last {@link DEFAULT_WINDOW_DAYS} days ending
 * now) is used and `defaulted` is true. `now` is injectable for tests.
 */
export function resolveRange(
  query: Request["query"],
  now: number = Date.now(),
): ResolvedRange {
  const rawFrom = typeof query.from === "string" ? query.from : undefined;
  const rawTo = typeof query.to === "string" ? query.to : undefined;

  if (
    rawFrom !== undefined &&
    rawTo !== undefined &&
    isValidIso(rawFrom) &&
    isValidIso(rawTo) &&
    Date.parse(rawFrom) <= Date.parse(rawTo)
  ) {
    return { from: rawFrom, to: rawTo, defaulted: false };
  }

  const to = new Date(now).toISOString();
  const from = new Date(now - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { from, to, defaulted: true };
}

/** Resolve the `groupBy` query param, ignoring unknown values. */
export function resolveGroupBy(query: Request["query"]): TokenGroupBy | undefined {
  const raw = typeof query.groupBy === "string" ? query.groupBy : undefined;
  return raw !== undefined && VALID_GROUP_BY.has(raw) ? (raw as TokenGroupBy) : undefined;
}

export const registerCommandCenterRoutes: ApiRouteRegistrar = (ctx) => {
  const { router, getScopedStore, rethrowAsApiError } = ctx;

  /**
   * GET /api/command-center/tokens
   * Token consumption + derived USD cost (U2 + U3) over a date range.
   * Query: from, to (ISO-8601), groupBy (model|provider|node|agent).
   */
  router.get("/command-center/tokens", async (req, res) => {
    try {
      const store = await getScopedStore(req);
      const range = resolveRange(req.query);
      const groupBy = resolveGroupBy(req.query);
      const result = aggregateTokenAnalytics(store.getDatabase(), {
        from: range.from,
        to: range.to,
        groupBy,
        now: Date.now(),
      });
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      rethrowAsApiError(err, "Failed to aggregate token analytics");
    }
  });

  /**
   * GET /api/command-center/tools
   * Tool-usage counts + autonomy ratio (U2) over a date range.
   */
  router.get("/command-center/tools", async (req, res) => {
    try {
      const store = await getScopedStore(req);
      const range = resolveRange(req.query);
      const result = aggregateToolAnalytics(store.getDatabase(), {
        from: range.from,
        to: range.to,
      });
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      rethrowAsApiError(err, "Failed to aggregate tool analytics");
    }
  });

  /**
   * GET /api/command-center/activity
   * Sessions/messages/active-nodes/stickiness (U2) over a date range.
   */
  router.get("/command-center/activity", async (req, res) => {
    try {
      const store = await getScopedStore(req);
      const range = resolveRange(req.query);
      const result = aggregateActivityAnalytics(store.getDatabase(), {
        from: range.from,
        to: range.to,
      });
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      rethrowAsApiError(err, "Failed to aggregate activity analytics");
    }
  });

  /**
   * GET /api/command-center/productivity
   * Files/commits/PRs/LOC (U2) over a date range.
   */
  router.get("/command-center/productivity", async (req, res) => {
    try {
      const store = await getScopedStore(req);
      const range = resolveRange(req.query);
      const result = aggregateProductivityAnalytics(store.getDatabase(), {
        from: range.from,
        to: range.to,
      });
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      rethrowAsApiError(err, "Failed to aggregate productivity analytics");
    }
  });

  /**
   * GET /api/command-center/live
   * Live Mission-Control snapshot (U6a): active sessions/runs/nodes + current
   * per-column task counts. No date range — current state only. Scoped + authed
   * like every other endpoint.
   */
  router.get("/command-center/live", async (req, res) => {
    try {
      const store = await getScopedStore(req);
      const result = composeLiveSnapshot(store.getDatabase());
      res.json(result);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      rethrowAsApiError(err, "Failed to compose live snapshot");
    }
  });
};

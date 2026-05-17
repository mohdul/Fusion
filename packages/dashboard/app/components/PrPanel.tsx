import { useCallback, useMemo, useState } from "react";
import { GitPullRequest, ExternalLink, RefreshCw, Plus, MessageSquare, CircleDot, XCircle, GitMerge } from "lucide-react";
import { getErrorMessage } from "@fusion/core";
import { refreshPrStatus, type PrCheckStatus, type PrInfo, type PrRefreshResponse } from "../api";
import { usePrChecksStream } from "../hooks/usePrChecksStream";
import { PrChecksList } from "./PrChecksList";
import type { ToastType } from "../hooks/useToast";
import "./PrPanel.css";

interface PrPanelProps {
  taskId: string;
  projectId?: string;
  prInfo?: PrInfo;
  automationStatus?: string | null;
  autoMerge?: boolean;
  isManualPrFlow?: boolean;
  prAuthAvailable: boolean;
  onPrUpdated: (prInfo: PrInfo) => void;
  onRequestCreatePr?: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <CircleDot size={16} />,
  closed: <XCircle size={16} />,
  merged: <GitMerge size={16} />,
};

type PrCheckState = PrCheckStatus["state"];

const PASSING_STATES = new Set<PrCheckState>(["success", "neutral", "skipped"]);
const FAILING_STATES = new Set<PrCheckState>(["failure", "error", "cancelled", "timed_out", "action_required", "startup_failure"]);
const PENDING_STATES = new Set<PrCheckState>(["pending", "stale"]);

function getReviewTone(reviewDecision: PrRefreshResponse["reviewDecision"]): "success" | "error" | "warning" | "muted" {
  if (reviewDecision === "APPROVED") return "success";
  if (reviewDecision === "CHANGES_REQUESTED") return "error";
  if (reviewDecision === "REVIEW_REQUIRED") return "warning";
  return "muted";
}

export function PrPanel({
  taskId,
  projectId,
  prInfo,
  automationStatus,
  autoMerge = false,
  isManualPrFlow = false,
  prAuthAvailable,
  onPrUpdated,
  onRequestCreatePr,
  addToast,
}: PrPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshState, setRefreshState] = useState<PrRefreshResponse | null>(null);

  const handleRefresh = useCallback(async () => {
    if (!prInfo) return;

    setIsRefreshing(true);
    try {
      const updated = await refreshPrStatus(taskId, projectId);
      setRefreshState(updated);
      onPrUpdated(updated.prInfo);
      addToast("PR status refreshed", "success");
    } catch (err) {
      addToast(getErrorMessage(err) || "Failed to refresh PR", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [taskId, projectId, prInfo, onPrUpdated, addToast]);

  if (!prInfo) {
    if (automationStatus === "creating-pr") {
      return (
        <div className="pr-section">
          <h4>
            <GitPullRequest size={16} className="pr-section-icon" />
            Pull Request
          </h4>
          <div className="pr-hint pr-hint--muted">fn is creating a pull request automatically for this task.</div>
        </div>
      );
    }

    if (autoMerge) {
      return (
        <div className="pr-section">
          <h4>
            <GitPullRequest size={16} className="pr-section-icon" />
            Pull Request
          </h4>
          <div className="pr-hint pr-hint--muted">Auto-merge will handle this task automatically.</div>
        </div>
      );
    }

    const createDisabled = !prAuthAvailable || !onRequestCreatePr;

    return (
      <div className="pr-section">
        <h4>
          <GitPullRequest size={16} className="pr-section-icon" />
          Pull Request
        </h4>
        <button
          className="btn btn-primary btn-sm"
          onClick={onRequestCreatePr}
          disabled={createDisabled}
          title={prAuthAvailable ? "Create a PR for this task" : "PR auth unavailable — run 'gh auth login'"}
        >
          <Plus />
          Create PR
        </button>
        {isManualPrFlow && <div className="pr-hint pr-hint--subtle">Use the footer action to run PR-first completion for this task.</div>}
        {(!prAuthAvailable || !onRequestCreatePr) && (
          <div className="pr-hint pr-hint--subtle">
            Run <code>gh auth login</code> to enable PR creation.
          </div>
        )}
      </div>
    );
  }

  const statusIcon = STATUS_ICONS[prInfo.status] ?? <CircleDot size={16} />;
  const blockingReasons = refreshState?.blockingReasons ?? [];
  const checks = refreshState?.checks;
  const reviewDecision = refreshState?.reviewDecision ?? null;

  const checkSummary = useMemo(() => {
    if (!checks) return "unknown" as const;
    if (checks.some((check) => FAILING_STATES.has(check.state))) return "failure" as const;
    if (checks.some((check) => PENDING_STATES.has(check.state))) return "pending" as const;
    if (checks.some((check) => PASSING_STATES.has(check.state))) return "success" as const;
    return "unknown" as const;
  }, [checks]);

  const streamChecks = usePrChecksStream({
    taskId,
    projectId,
    prNumber: prInfo.number,
    enabled: prInfo.status !== "merged" && prInfo.status !== "closed",
    initialChecks: checks ?? [],
    initialRollup: checkSummary,
    initialLastCheckedAt: prInfo.lastCheckedAt,
  });

  return (
    <div className="pr-section">
      <h4>
        <GitPullRequest size={16} className="pr-section-icon" />
        Pull Request
      </h4>
      <div className={`pr-card pr-card--status-${prInfo.status}`}>
        <div className="pr-header">
          <span className="pr-status-icon">{statusIcon}</span>
          <span className={`pr-status-badge pr-status-badge--${prInfo.status}`}>{prInfo.status}</span>
          <span className="pr-number">#{prInfo.number}</span>
          <div className="pr-spacer" />
          <button className="btn btn-sm pr-refresh-btn" onClick={handleRefresh} disabled={isRefreshing} title="Refresh PR status">
            <RefreshCw size={14} className={isRefreshing ? "spin pr-panel-refresh-icon--muted" : undefined} />
          </button>
        </div>
        <div className="pr-title">{prInfo.title}</div>
        <div className="pr-meta">
          <span>{prInfo.headBranch}</span>
          <span className="pr-meta-arrow">→</span>
          <span>{prInfo.baseBranch}</span>
        </div>

        {prInfo.status !== "merged" && prInfo.status !== "closed" ? (
          <PrChecksList
            checks={streamChecks.checks}
            rollup={streamChecks.rollup}
            lastCheckedAt={streamChecks.lastCheckedAt}
            loading={streamChecks.loading}
            error={streamChecks.error}
            onRefresh={() => {
              void streamChecks.refresh();
            }}
          />
        ) : null}

        <div className="pr-panel-section">
          <div className="pr-panel-row-label">Review</div>
          {reviewDecision ? (
            <span className={`pr-panel-review-badge pr-panel-review-badge--${getReviewTone(reviewDecision)}`}>{reviewDecision}</span>
          ) : (
            <span className="pr-panel-tone-muted">No reviews yet</span>
          )}
        </div>

        {automationStatus === "merging-pr" && <div className="pr-hint pr-hint--info">fn is merging this pull request automatically.</div>}
        {automationStatus === "awaiting-pr-checks" && (
          <div className="pr-hint pr-hint--info">
            {blockingReasons.length > 0
              ? `Waiting for: ${blockingReasons.join("; ")}`
              : "Waiting for required checks or review feedback before auto-merge."}
          </div>
        )}
        {prInfo.status === "merged" && (
          <div className="pr-hint pr-hint--info">This PR is merged. fn will finish local cleanup and move the task to Done.</div>
        )}

        <div className="pr-footer">
          <span className="pr-comments">
            <MessageSquare size={14} />
            {prInfo.commentCount}
            {prInfo.lastCommentAt ? <span className="pr-panel-comment-time">Last: {new Date(prInfo.lastCommentAt).toLocaleString()}</span> : null}
          </span>
          <a href={prInfo.url} target="_blank" rel="noopener noreferrer" className="pr-link">
            <ExternalLink size={14} />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

import type { PluginDashboardViewContext } from "@fusion/dashboard/app/plugins/types";

/**
 * Placeholder dashboard surface for the Compound Engineering plugin.
 *
 * U1 ships only a loadable scaffold. The real artifact hub and interactive
 * ce-* session surface arrive in later units (U3+).
 */
export function CompoundEngineeringDashboardView(_props: { context?: PluginDashboardViewContext }) {
  return <div data-testid="compound-engineering-view">Compound Engineering</div>;
}

export default CompoundEngineeringDashboardView;

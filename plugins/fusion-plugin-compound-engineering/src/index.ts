import { definePlugin } from "@fusion/plugin-sdk";

export { CompoundEngineeringDashboardView } from "./dashboard-view.js";

const plugin = definePlugin({
  manifest: {
    id: "fusion-plugin-compound-engineering",
    name: "Compound Engineering",
    version: "0.1.0",
    description: "A dedicated dashboard surface for compound-engineering artifacts and interactive ce-* sessions.",
    author: "Fusion Team",
    fusionVersion: ">=0.1.0",
  },
  state: "installed",
  hooks: {},
  routes: [],
  dashboardViews: [
    {
      viewId: "compound-engineering",
      label: "Compound Engineering",
      componentPath: "./dashboard-view",
      icon: "Sparkles",
      placement: "primary",
      order: 36,
    },
  ],
});

export default plugin;

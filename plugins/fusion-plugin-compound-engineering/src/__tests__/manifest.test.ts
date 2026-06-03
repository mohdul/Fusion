import { describe, expect, it } from "vitest";
import manifest from "../../manifest.json";
import plugin from "../index.js";

describe("compound engineering plugin manifest", () => {
  it("exports expected plugin id", () => {
    expect(plugin.manifest.id).toBe("fusion-plugin-compound-engineering");
  });

  it("keeps runtime manifest metadata aligned with manifest.json", () => {
    expect(plugin.manifest.id).toBe(manifest.id);
    expect(plugin.manifest.name).toBe(manifest.name);
    expect(plugin.manifest.version).toBe(manifest.version);
    expect(plugin.manifest.description).toBe(manifest.description);
    expect(plugin.manifest.author).toBe(manifest.author);
    expect(plugin.manifest.fusionVersion).toBe(manifest.fusionVersion);
  });

  it("registers a single dashboard view", () => {
    expect(plugin.dashboardViews).toEqual([
      {
        viewId: "compound-engineering",
        label: "Compound Engineering",
        componentPath: "./dashboard-view",
        icon: "Sparkles",
        placement: "primary",
        order: 36,
      },
    ]);
    expect(manifest.dashboardViews).toEqual(plugin.dashboardViews);
  });

  it("ships an empty hooks/routes scaffold (U1)", () => {
    expect(plugin.hooks).toEqual({});
    expect(plugin.routes).toEqual([]);
  });
});

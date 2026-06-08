import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewportMode, MOBILE_MEDIA_QUERY, useViewportMode } from "../useViewportMode";

describe("useViewportMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats short landscape phones as mobile", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches:
          query === MOBILE_MEDIA_QUERY
            ? true
            : query === "(min-width: 769px) and (max-width: 1024px)"
              ? false
              : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    expect(getViewportMode()).toBe("mobile");
    expect(renderHook(() => useViewportMode()).result.current).toBe("mobile");
  });

  it("supports legacy MediaQueryList listeners without runtime errors", () => {
    const listeners: Array<() => void> = [];
    const removeListener = vi.fn((listener: () => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === MOBILE_MEDIA_QUERY,
        media: query,
        onchange: null,
        addListener: (listener: () => void) => listeners.push(listener),
        removeListener,
      })),
    );

    renderHook(() => useViewportMode());

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

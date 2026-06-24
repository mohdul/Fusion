import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBoardScrollRestore } from "../useBoardScrollRestore";

vi.mock("../../utils/boardScrollSnapshot", () => ({
  captureBoardScrollSnapshot: vi.fn(() => ({ x: 10, columns: {} })),
  restoreBoardScrollSnapshot: vi.fn(() => true),
}));

describe("useBoardScrollRestore", () => {
  it("exposes capture and requestRestore without throwing", () => {
    const { result } = renderHook(() => useBoardScrollRestore("board"));

    expect(typeof result.current.capture).toBe("function");
    expect(typeof result.current.requestRestore).toBe("function");
    expect(() => result.current.capture()).not.toThrow();
    expect(() => result.current.requestRestore()).not.toThrow();
  });
});

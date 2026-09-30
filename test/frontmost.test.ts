import { describe, expect, it } from "vitest";
import { createFrontmost } from "../src/frontmost";

describe("createFrontmost", () => {
  it("asks System Events for the frontmost process name", async () => {
    const calls: string[][] = [];
    const frontmost = createFrontmost(async (args) => {
      calls.push(args);
      return "iTerm2";
    });
    expect(await frontmost()).toBe("iTerm2");
    expect(calls).toEqual([
      ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'],
    ]);
  });

  it("propagates runner errors", async () => {
    const frontmost = createFrontmost(async () => {
      throw new Error("boom");
    });
    await expect(frontmost()).rejects.toThrow("boom");
  });
});

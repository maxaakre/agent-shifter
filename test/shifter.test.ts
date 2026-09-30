import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../src/gears";
import { createShifter } from "../src/shifter";
import { FocusChangedError } from "../src/typer";

function setup(app = "iTerm2") {
  const typed: string[] = [];
  const shifter = createShifter({
    config: DEFAULT_CONFIG,
    frontmost: async () => app,
    type: async (text) => {
      typed.push(text);
    },
  });
  return { shifter, typed };
}

describe("createShifter", () => {
  it("types /model <id> in an allowed app and records the gear", async () => {
    const { shifter, typed } = setup("nodeterm");
    expect(await shifter.shift("2")).toEqual({ ok: true, gear: "2", model: "claude-sonnet-5-5" });
    expect(typed).toEqual(["/model claude-sonnet-5-5"]);
    expect(shifter.current()).toBe("2");
  });

  it("types nothing in an app that is not allowed", async () => {
    const { shifter, typed } = setup("Slack");
    expect(await shifter.shift("2")).toEqual({ ok: false, reason: "not-allowed", detail: "Slack" });
    expect(typed).toEqual([]);
    expect(shifter.current()).toBeNull();
  });

  it("matches app names case-sensitively", async () => {
    const { shifter, typed } = setup("iterm2");
    expect((await shifter.shift("1")).ok).toBe(false);
    expect(typed).toEqual([]);
  });

  it("rejects an unknown gear without checking the app", async () => {
    let asked = false;
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => {
        asked = true;
        return "iTerm2";
      },
      type: async () => {},
    });
    expect(await shifter.shift("9")).toEqual({ ok: false, reason: "unknown-gear", detail: "9" });
    expect(asked).toBe(false);
  });

  it("reports an error when the frontmost lookup fails", async () => {
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => {
        throw new Error("no access");
      },
      type: async () => {},
    });
    expect(await shifter.shift("1")).toEqual({ ok: false, reason: "error", detail: "no access" });
  });

  it("reports an error and keeps the old gear when typing fails", async () => {
    let fail = false;
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "Terminal",
      type: async () => {
        if (fail) throw new Error("typing failed");
      },
    });
    await shifter.shift("1");
    fail = true;
    expect(await shifter.shift("3")).toEqual({ ok: false, reason: "error", detail: "typing failed" });
    expect(shifter.current()).toBe("1");
  });

  it("reports busy for a second shift while one is running", async () => {
    let release!: () => void;
    const typed: string[] = [];
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: (text) =>
        new Promise<void>((resolve) => {
          typed.push(text);
          release = resolve;
        }),
    });
    const first = shifter.shift("3");
    expect(await shifter.shift("3")).toEqual({ ok: false, reason: "busy" });
    await vi.waitFor(() => expect(typed).toHaveLength(1)); // first shift is inside type()
    release();
    expect((await first).ok).toBe(true);
    expect(typed).toEqual(["/model claude-opus-5-5"]);
    // Not busy any more.
    const again = shifter.shift("1");
    await vi.waitFor(() => expect(typed).toHaveLength(2));
    release();
    expect((await again).ok).toBe(true);
  });

  it("passes the allowed apps to the typer", async () => {
    let seen: string[] | undefined;
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: async (_text, allowedApps) => {
        seen = allowedApps;
      },
    });
    await shifter.shift("1");
    expect(seen).toEqual(DEFAULT_CONFIG.allowedApps);
  });

  it("reports not-allowed and keeps the old gear when focus moves during typing", async () => {
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: async () => {
        throw new FocusChangedError("Slack");
      },
      initialGear: "2",
    });
    expect(await shifter.shift("3")).toEqual({ ok: false, reason: "not-allowed", detail: "Slack" });
    expect(shifter.current()).toBe("2");
  });

  it("starts from initialGear when given", () => {
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: async () => {},
      initialGear: "4",
    });
    expect(shifter.current()).toBe("4");
  });
});

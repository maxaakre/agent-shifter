import { describe, expect, it } from "vitest";
import { FocusChangedError, MODIFIERS_HELD_MESSAGE, TYPE_SCRIPT, createTyper } from "../src/typer";

const APPS = ["iTerm2", "nodeterm"];

describe("createTyper", () => {
  it("passes the text and allowed apps as argv values, not inside the script", async () => {
    const calls: string[][] = [];
    const type = createTyper(async (args) => {
      calls.push(args);
      return "ok";
    });
    const nasty = '-x"\\ y';
    await type(nasty, APPS);
    expect(calls).toEqual([["-l", "JavaScript", "-e", TYPE_SCRIPT, "--", nasty, JSON.stringify(APPS)]]);
    expect(TYPE_SCRIPT).not.toContain(nasty);
  });

  it("waits for modifiers, re-checks the frontmost app, and presses Return in the script", () => {
    expect(TYPE_SCRIPT).toContain("modifierFlags");
    expect(TYPE_SCRIPT).toContain("frontmost");
    expect(TYPE_SCRIPT).toContain("keyCode(36)");
    // The focus check must come after the modifier wait and before any keystroke.
    const wait = TYPE_SCRIPT.indexOf("modifierFlags");
    const check = TYPE_SCRIPT.indexOf("frontmost");
    const keys = TYPE_SCRIPT.indexOf("keystroke(");
    expect(wait).toBeLessThan(check);
    expect(check).toBeLessThan(keys);
  });

  it("rejects with a clear message when modifiers stay held", async () => {
    const type = createTyper(async () => "modifiers-held");
    await expect(type("/model x", APPS)).rejects.toThrow(MODIFIERS_HELD_MESSAGE);
  });

  it("rejects with FocusChangedError naming the app when focus moved during the wait", async () => {
    const type = createTyper(async () => "not-allowed:Slack");
    const err = await type("/model x", APPS).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FocusChangedError);
    expect((err as FocusChangedError).app).toBe("Slack");
  });

  it("rejects on unexpected script output", async () => {
    const type = createTyper(async () => "");
    await expect(type("/model x", APPS)).rejects.toThrow("Unexpected typer output");
  });

  it("propagates runner errors", async () => {
    const type = createTyper(async () => {
      throw new Error("not allowed assistive access");
    });
    await expect(type("/model x", APPS)).rejects.toThrow("assistive");
  });
});

import { describe, expect, it } from "vitest";
import { MODIFIERS_HELD_MESSAGE, TYPE_SCRIPT, createTyper } from "../src/typer";

describe("createTyper", () => {
  it("passes the text as an argv value, not inside the script", async () => {
    const calls: string[][] = [];
    const type = createTyper(async (args) => {
      calls.push(args);
      return "ok";
    });
    const nasty = '-x"\\ y';
    await type(nasty);
    expect(calls).toEqual([["-l", "JavaScript", "-e", TYPE_SCRIPT, "--", nasty]]);
    expect(TYPE_SCRIPT).not.toContain(nasty);
  });

  it("waits for modifiers and presses Return in the script", () => {
    expect(TYPE_SCRIPT).toContain("modifierFlags");
    expect(TYPE_SCRIPT).toContain("keyCode(36)");
  });

  it("rejects with a clear message when modifiers stay held", async () => {
    const type = createTyper(async () => "modifiers-held");
    await expect(type("/model x")).rejects.toThrow(MODIFIERS_HELD_MESSAGE);
  });

  it("propagates runner errors", async () => {
    const type = createTyper(async () => {
      throw new Error("not allowed assistive access");
    });
    await expect(type("/model x")).rejects.toThrow("assistive");
  });
});

import { describe, expect, it } from "vitest";
import { describeResult } from "../src/messages";
import { MODIFIERS_HELD_MESSAGE } from "../src/typer";

describe("describeResult", () => {
  it("is silent on success and busy", () => {
    expect(describeResult({ ok: true, gear: "2", model: "claude-sonnet-5-5" })).toBeNull();
    expect(describeResult({ ok: false, reason: "busy" })).toBeNull();
  });

  it("names the blocked app", () => {
    expect(describeResult({ ok: false, reason: "not-allowed", detail: "Slack" })).toBe(
      "Not a terminal: Slack",
    );
  });

  it("names the unknown gear", () => {
    expect(describeResult({ ok: false, reason: "unknown-gear", detail: "9" })).toBe("No model set for gear 9");
  });

  it("explains how to grant Accessibility access", () => {
    for (const detail of ["osascript is not allowed assistive access", "execution error (-1719)", "(-25211)"]) {
      expect(describeResult({ ok: false, reason: "error", detail })).toBe(
        "Grant Accessibility access: System Settings → Privacy & Security → Accessibility",
      );
    }
  });

  it("passes the modifiers-held message through", () => {
    expect(describeResult({ ok: false, reason: "error", detail: MODIFIERS_HELD_MESSAGE })).toBe(
      MODIFIERS_HELD_MESSAGE,
    );
  });

  it("shows other errors", () => {
    expect(describeResult({ ok: false, reason: "error", detail: "boom" })).toBe("Shift failed: boom");
  });
});

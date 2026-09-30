import { describe, expect, it } from "vitest";
import { registerGearHotkeys } from "../src/hotkeys";

describe("registerGearHotkeys", () => {
  it("registers <prefix>+<gear> for each gear, in order, and wires callbacks", () => {
    const registered: Record<string, () => void> = {};
    const pressed: string[] = [];
    const failed = registerGearHotkeys(
      { "3": "c", "1": "a", "2": "b" },
      "Control+Alt",
      (acc, cb) => {
        registered[acc] = cb;
        return true;
      },
      (gear) => pressed.push(gear),
    );
    expect(failed).toEqual([]);
    expect(Object.keys(registered)).toEqual(["Control+Alt+1", "Control+Alt+2", "Control+Alt+3"]);
    registered["Control+Alt+2"]();
    expect(pressed).toEqual(["2"]);
  });

  it("reports taken and invalid hotkeys but keeps the rest", () => {
    const registered: string[] = [];
    const failed = registerGearHotkeys(
      { "1": "a", "2": "b", "3": "c" },
      "Control+Alt",
      (acc) => {
        if (acc.endsWith("+1")) return false; // taken by another app
        if (acc.endsWith("+2")) throw new Error("conversion failure"); // invalid
        registered.push(acc);
        return true;
      },
      () => {},
    );
    expect(failed).toEqual(["Control+Alt+1", "Control+Alt+2"]);
    expect(registered).toEqual(["Control+Alt+3"]);
  });
});

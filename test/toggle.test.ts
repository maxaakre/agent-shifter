import { describe, expect, it } from "vitest";
import { createToggle } from "../src/toggle";

function setup(initial?: boolean, failed: string[] = []) {
  const calls: string[] = [];
  const toggle = createToggle({
    register: () => {
      calls.push("register");
      return failed;
    },
    unregister: () => {
      calls.push("unregister");
    },
    initial,
  });
  return { toggle, calls };
}

describe("createToggle", () => {
  it("starts on by default without touching hotkeys", () => {
    const { toggle, calls } = setup();
    expect(toggle.isOn()).toBe(true);
    expect(calls).toEqual([]);
  });

  it("turning off releases the gear hotkeys", () => {
    const { toggle, calls } = setup();
    expect(toggle.set(false)).toEqual([]);
    expect(toggle.isOn()).toBe(false);
    expect(calls).toEqual(["unregister"]);
  });

  it("turning on again registers them and returns failures", () => {
    const { toggle, calls } = setup(false, ["Control+Alt+2"]);
    expect(toggle.set(true)).toEqual(["Control+Alt+2"]);
    expect(toggle.isOn()).toBe(true);
    expect(calls).toEqual(["register"]);
  });

  it("does nothing when set to the state it is already in", () => {
    const { toggle, calls } = setup();
    expect(toggle.set(true)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("toggle() flips back and forth", () => {
    const { toggle, calls } = setup();
    toggle.toggle();
    expect(toggle.isOn()).toBe(false);
    toggle.toggle();
    expect(toggle.isOn()).toBe(true);
    expect(calls).toEqual(["unregister", "register"]);
  });
});

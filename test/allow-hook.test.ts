import { describe, expect, it } from "vitest";
import { ALLOW_OUTPUT, decide } from "../src/allow-hook";

const INPUT = {
  hook_event_name: "PreModelSwitch",
  source: "command",
  requested_model: "claude-opus-5-5",
  to_model: "claude-opus-5-5",
};

function consumer(result: boolean) {
  const calls: (string | null)[] = [];
  const consume = async (model: string | null) => {
    calls.push(model);
    return result;
  };
  return { consume, calls };
}

describe("decide", () => {
  it("allows a /model command the shifter announced", async () => {
    const { consume, calls } = consumer(true);
    expect(await decide(INPUT, consume)).toEqual(ALLOW_OUTPUT);
    expect(calls).toEqual(["claude-opus-5-5"]);
  });

  it("stays silent when the shifter did not announce it", async () => {
    const { consume } = consumer(false);
    expect(await decide(INPUT, consume)).toBeNull();
  });

  it("ignores switches from the picker or other sources", async () => {
    const { consume, calls } = consumer(true);
    expect(await decide({ ...INPUT, source: "picker" }, consume)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("ignores other hook events", async () => {
    const { consume, calls } = consumer(true);
    expect(await decide({ ...INPUT, hook_event_name: "PostModelSwitch" }, consume)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("ignores input that is not an object", async () => {
    const { consume } = consumer(true);
    expect(await decide(null, consume)).toBeNull();
    expect(await decide("x", consume)).toBeNull();
  });

  it("passes null when requested_model is missing", async () => {
    const { consume, calls } = consumer(false);
    await decide({ ...INPUT, requested_model: undefined }, consume);
    expect(calls).toEqual([null]);
  });

  it("allow output matches the documented PreModelSwitch shape", () => {
    expect(ALLOW_OUTPUT).toEqual({
      hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "allow" },
    });
  });
});

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "../src/config";
import { DEFAULT_CONFIG } from "../src/gears";

async function tempPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-shifter-"));
  return join(dir, "nested", "config.json");
}

describe("validateConfig", () => {
  it("accepts the defaults", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
  });

  it("rejects a gear key that is not a single digit 1-9", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, gears: { "10": "claude-opus-5-5" } })).toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, gears: { "0": "claude-opus-5-5" } })).toBeNull();
  });

  it("rejects an empty or whitespace model id", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, gears: { "1": "" } })).toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, gears: { "1": "claude opus" } })).toBeNull();
  });

  it("rejects empty gears, empty prefix, and empty allowedApps", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, gears: {} })).toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, hotkeyPrefix: "" })).toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, allowedApps: [] })).toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, allowedApps: [""] })).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(validateConfig(null)).toBeNull();
    expect(validateConfig("x")).toBeNull();
    expect(validateConfig([])).toBeNull();
  });
});

describe("loadConfig", () => {
  it("writes defaults when the file is missing", async () => {
    const path = await tempPath();
    const result = await loadConfig(path);
    expect(result).toEqual({ config: DEFAULT_CONFIG });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(DEFAULT_CONFIG);
  });

  it("loads a valid file", async () => {
    const path = await tempPath();
    await loadConfig(path); // creates the directory
    const custom = { ...DEFAULT_CONFIG, allowedApps: ["iTerm2"] };
    await writeFile(path, JSON.stringify(custom));
    expect(await loadConfig(path)).toEqual({ config: custom });
  });

  it("falls back to defaults with a warning on invalid JSON", async () => {
    const path = await tempPath();
    await loadConfig(path);
    await writeFile(path, "{ not json");
    expect(await loadConfig(path)).toEqual({
      config: DEFAULT_CONFIG,
      warning: "Config invalid, using defaults",
    });
  });

  it("falls back to defaults with a warning on a bad schema", async () => {
    const path = await tempPath();
    await loadConfig(path);
    await writeFile(path, JSON.stringify({ ...DEFAULT_CONFIG, gears: { "10": "x" } }));
    expect(await loadConfig(path)).toEqual({
      config: DEFAULT_CONFIG,
      warning: "Config invalid, using defaults",
    });
  });
});

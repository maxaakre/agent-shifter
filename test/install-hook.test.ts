import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addHook, removeHook, updateSettingsFile } from "../src/install-hook";

const CMD = '"/usr/bin/node" "/repo/dist/allow-hook.js"';
const OURS = { hooks: [{ type: "command", command: CMD }] };
const OTHER = { hooks: [{ type: "command", command: "echo other" }] };

describe("addHook", () => {
  it("adds a PreModelSwitch entry to empty settings", () => {
    expect(addHook({}, CMD)).toEqual({ hooks: { PreModelSwitch: [OURS] } });
  });

  it("keeps other settings and other hooks", () => {
    const settings = { model: "x", hooks: { Stop: [OTHER], PreModelSwitch: [OTHER] } };
    expect(addHook(settings, CMD)).toEqual({
      model: "x",
      hooks: { Stop: [OTHER], PreModelSwitch: [OTHER, OURS] },
    });
  });

  it("does not add a second copy", () => {
    const once = addHook({}, CMD);
    expect(addHook(once, CMD)).toEqual(once);
  });

  it("does not change the input object", () => {
    const settings = { hooks: { PreModelSwitch: [OTHER] } };
    addHook(settings, CMD);
    expect(settings).toEqual({ hooks: { PreModelSwitch: [OTHER] } });
  });

  it("refuses settings that are not an object", () => {
    expect(() => addHook([], CMD)).toThrow("not a JSON object");
    expect(() => addHook({ hooks: "x" }, CMD)).toThrow("not a JSON object");
  });
});

describe("removeHook", () => {
  it("removes only our entry and drops empty lists", () => {
    expect(removeHook({ hooks: { PreModelSwitch: [OURS], Stop: [OTHER] } }, CMD)).toEqual({
      hooks: { Stop: [OTHER] },
    });
    expect(removeHook({ hooks: { PreModelSwitch: [OTHER, OURS] } }, CMD)).toEqual({
      hooks: { PreModelSwitch: [OTHER] },
    });
  });

  it("leaves settings without our entry unchanged", () => {
    expect(removeHook({ model: "x" }, CMD)).toEqual({ model: "x" });
  });
});

describe("updateSettingsFile", () => {
  async function tempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), "agent-shifter-settings-"));
  }

  it("backs up the old file and writes the new settings", async () => {
    const dir = await tempDir();
    const path = join(dir, "settings.json");
    const original = '{\n  "model": "x"\n}\n';
    await writeFile(path, original);
    await updateSettingsFile(path, (s) => addHook(s, CMD));
    expect(await readFile(`${path}.bak`, "utf8")).toBe(original);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ model: "x", hooks: { PreModelSwitch: [OURS] } });
  });

  it("creates the file when missing, with no backup", async () => {
    const dir = await tempDir();
    const path = join(dir, "settings.json");
    await updateSettingsFile(path, (s) => addHook(s, CMD));
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ hooks: { PreModelSwitch: [OURS] } });
    await expect(readFile(`${path}.bak`)).rejects.toThrow();
  });

  it("refuses to touch a file that is not valid JSON", async () => {
    const dir = await tempDir();
    const path = join(dir, "settings.json");
    await writeFile(path, "{ broken");
    await expect(updateSettingsFile(path, (s) => addHook(s, CMD))).rejects.toThrow("not valid JSON");
    expect(await readFile(path, "utf8")).toBe("{ broken");
  });
});

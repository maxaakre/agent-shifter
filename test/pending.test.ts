import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PENDING_MAX_AGE_MS, consumePending, writePending } from "../src/pending";

async function tempPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-shifter-pending-"));
  return join(dir, "nested", "pending.json");
}

async function exists(path: string): Promise<boolean> {
  return readFile(path).then(
    () => true,
    () => false,
  );
}

describe("writePending", () => {
  it("writes the model and time, creating the directory", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ model: "claude-opus-5-5", at: 1000 });
  });
});

describe("consumePending", () => {
  it("accepts a fresh note for the same model and deletes it", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    expect(await consumePending("claude-opus-5-5", path, 1000 + PENDING_MAX_AGE_MS - 1)).toBe(true);
    expect(await exists(path)).toBe(false);
  });

  it("works only once", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    await consumePending("claude-opus-5-5", path, 1001);
    expect(await consumePending("claude-opus-5-5", path, 1002)).toBe(false);
  });

  it("rejects and deletes a stale note", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    expect(await consumePending("claude-opus-5-5", path, 1000 + PENDING_MAX_AGE_MS)).toBe(false);
    expect(await exists(path)).toBe(false);
  });

  it("rejects a note for a different model and keeps it", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    expect(await consumePending("claude-haiku-4-5-20251001", path, 1001)).toBe(false);
    expect(await exists(path)).toBe(true);
  });

  it("rejects a note from the future (clock change)", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 5000);
    expect(await consumePending("claude-opus-5-5", path, 1000)).toBe(false);
  });

  it("rejects when there is no note, or it is not valid JSON", async () => {
    const path = await tempPath();
    expect(await consumePending("claude-opus-5-5", path, 1000)).toBe(false);
    await writePending("x", path, 1000); // creates the directory
    await writeFile(path, "{ nope");
    expect(await consumePending("claude-opus-5-5", path, 1000)).toBe(false);
  });

  it("rejects a null model", async () => {
    const path = await tempPath();
    await writePending("claude-opus-5-5", path, 1000);
    expect(await consumePending(null, path, 1001)).toBe(false);
  });
});

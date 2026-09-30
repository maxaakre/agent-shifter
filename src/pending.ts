import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// A short-lived note: "the shifter is about to switch to this model".
// The PreModelSwitch hook reads it to skip the confirmation for our own switches only.
export const DEFAULT_PENDING_PATH = join(homedir(), ".config", "agent-shifter", "pending.json");
export const PENDING_MAX_AGE_MS = 5000;

export async function writePending(
  model: string,
  path: string = DEFAULT_PENDING_PATH,
  now: number = Date.now(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ model, at: now }));
}

export async function consumePending(
  model: string | null,
  path: string = DEFAULT_PENDING_PATH,
  now: number = Date.now(),
): Promise<boolean> {
  let note: unknown;
  try {
    note = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return false;
  }
  const { model: noted, at } = (note ?? {}) as { model?: unknown; at?: unknown };
  if (typeof noted !== "string" || typeof at !== "number") return false;

  const age = now - at;
  if (age < 0 || age >= PENDING_MAX_AGE_MS) {
    await rm(path, { force: true });
    return false;
  }
  if (model === null || noted !== model) return false;
  await rm(path, { force: true });
  return true;
}

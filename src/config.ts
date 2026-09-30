import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Config, DEFAULT_CONFIG } from "./gears";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "agent-shifter", "config.json");

export interface LoadResult {
  config: Config;
  warning?: string;
}

const INVALID = "Config invalid, using defaults";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateConfig(value: unknown): Config | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { gears, hotkeyPrefix, allowedApps } = value as Record<string, unknown>;

  if (typeof gears !== "object" || gears === null || Array.isArray(gears)) return null;
  const entries = Object.entries(gears as Record<string, unknown>);
  if (entries.length === 0) return null;
  for (const [key, model] of entries) {
    if (!/^[1-9]$/.test(key)) return null;
    // Model ids are typed verbatim after "/model ", so no whitespace allowed.
    if (typeof model !== "string" || !/^\S+$/.test(model)) return null;
  }

  if (!isNonEmptyString(hotkeyPrefix)) return null;
  if (!Array.isArray(allowedApps) || allowedApps.length === 0) return null;
  if (!allowedApps.every(isNonEmptyString)) return null;

  return {
    gears: Object.fromEntries(entries) as Record<string, string>,
    hotkeyPrefix,
    allowedApps: [...allowedApps],
  };
}

export async function loadConfig(path: string = DEFAULT_CONFIG_PATH): Promise<LoadResult> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
      return { config: DEFAULT_CONFIG };
    }
    return { config: DEFAULT_CONFIG, warning: INVALID };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { config: DEFAULT_CONFIG, warning: INVALID };
  }
  const config = validateConfig(parsed);
  return config ? { config } : { config: DEFAULT_CONFIG, warning: INVALID };
}

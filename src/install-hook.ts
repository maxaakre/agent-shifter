// Adds or removes the PreModelSwitch hook in ~/.claude/settings.json.
// Usage: node dist/install-hook.js install|uninstall
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type Settings = Record<string, unknown>;
type HookEntry = { hooks?: { command?: string }[] };

export const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const EVENT = "PreModelSwitch";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Settings are not a JSON object");
  }
  return value as Record<string, unknown>;
}

function isOurs(entry: unknown, command: string): boolean {
  return ((entry as HookEntry)?.hooks ?? []).some((h) => h?.command === command);
}

export function addHook(settings: unknown, command: string): Settings {
  const copy = { ...asObject(settings) };
  const hooks = { ...asObject(copy.hooks ?? {}) };
  const entries = Array.isArray(hooks[EVENT]) ? (hooks[EVENT] as unknown[]) : [];
  if (entries.some((e) => isOurs(e, command))) return copy;
  hooks[EVENT] = [...entries, { hooks: [{ type: "command", command }] }];
  copy.hooks = hooks;
  return copy;
}

export function removeHook(settings: unknown, command: string): Settings {
  const copy = { ...asObject(settings) };
  if (copy.hooks === undefined) return copy;
  const hooks = { ...asObject(copy.hooks) };
  if (!Array.isArray(hooks[EVENT])) return copy;
  const kept = (hooks[EVENT] as unknown[]).filter((e) => !isOurs(e, command));
  if (kept.length > 0) hooks[EVENT] = kept;
  else delete hooks[EVENT];
  copy.hooks = hooks;
  return copy;
}

export async function updateSettingsFile(path: string, change: (settings: unknown) => Settings): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  let current: unknown = {};
  if (raw !== null) {
    try {
      current = JSON.parse(raw);
    } catch {
      throw new Error(`${path} is not valid JSON; not changing it`);
    }
  }

  const next = change(current); // throws before anything is written
  if (raw !== null) await copyFile(path, `${path}.bak`);
  await writeFile(path, JSON.stringify(next, null, 2) + "\n");
}

// The node binary running this installer, and the compiled hook next to it.
export function hookCommand(): string {
  return `"${process.execPath}" "${join(__dirname, "allow-hook.js")}"`;
}

if (require.main === module) {
  const action = process.argv[2];
  if (action !== "install" && action !== "uninstall") {
    console.error("Usage: install-hook.js install|uninstall");
    process.exit(1);
  }
  const command = hookCommand();
  const change = action === "install" ? (s: unknown) => addHook(s, command) : (s: unknown) => removeHook(s, command);
  updateSettingsFile(SETTINGS_PATH, change)
    .then(() => {
      console.log(`${action === "install" ? "Installed" : "Removed"} PreModelSwitch hook in ${SETTINGS_PATH}`);
      console.log(`Backup: ${SETTINGS_PATH}.bak`);
      console.log("If an open Claude Code session does not pick it up, restart that session.");
    })
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}

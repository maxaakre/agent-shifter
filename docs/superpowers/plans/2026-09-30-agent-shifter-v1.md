# Agent Shifter v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A macOS menu bar app that switches a running Claude Code session's model by typing `/model <id>` into the focused terminal when a gear hotkey (`⌃⌥1`–`⌃⌥4`) or tray menu item is used.

**Architecture:** Electron provides the tray and global hotkeys (`main.ts`, thin glue only). All logic lives in small plain-TypeScript modules with injected dependencies so they are unit-tested with fakes: `config.ts` (load/validate), `frontmost.ts` + `typer.ts` (macOS `osascript` calls through one injectable runner), `shifter.ts` (the shift decision), `hotkeys.ts` (registration), `messages.ts` (result → notification text).

**Tech Stack:** TypeScript (strict, compiled to CommonJS with `tsc`), Electron, Vitest, Node 24, macOS `osascript` (AppleScript + JXA).

**Spec:** `docs/superpowers/specs/2026-09-30-agent-shifter-design.md`

## Global Constraints

- macOS only. No native Node add-ons; macOS access only via `osascript` called with `execFile` (never a shell string).
- Full model IDs: `claude-haiku-4-5-20251001`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-1` for gears 1–4.
- Config path: `~/.config/agent-shifter/config.json`. Defaults: `hotkeyPrefix` `"Control+Alt"`, `allowedApps` `["iTerm2", "Terminal", "nodeterm"]`.
- Gear keys are single digits `1`–`9`. Hotkey for gear `n` is `<hotkeyPrefix>+<n>`.
- `allowedApps` matches the System Events process name exactly (case-sensitive).
- Text typed is exactly `/model <model-id>` followed by Return.
- v1 runs with `npm start`; no packaging.

## Review Focus

1. **Hotkey modifiers still held while typing** — user presses `⌃⌥2` and is still holding ⌃⌥ when keys are sent; expect the typer to wait for release, and to fail with a clear message (typing nothing) if keys stay held. Pinned in Task 2 (`modifiers-held` test).
2. **Rapid repeated presses** — user taps `⌃⌥3` twice fast; expect one shift, second press reported as busy, never interleaved keystrokes. Pinned in Task 3 (`busy` test).
3. **Text with quotes/backslashes/leading dash** — a model id from config like `-x"\`; expect it passed as an argv value, never interpolated into script source. Pinned in Task 2 (argv test).
4. **Hand-edited config with a bad entry** — e.g. gear key `"10"` or an empty model string; expect whole config rejected, defaults used, warning shown. Pinned in Task 1 (schema tests).
5. **Invalid or taken hotkey accelerator** — e.g. `hotkeyPrefix: "Ctrl+Nope"`; Electron throws or returns false; expect that gear listed as failed and other gears still registered. Pinned in Task 4.

---

## File Structure

```
package.json
tsconfig.json
.gitignore
README.md
src/
  gears.ts       # Config type + DEFAULT_CONFIG (pure data)
  config.ts      # validateConfig, loadConfig
  osascript.ts   # Runner type + runOsascript (execFile wrapper)
  frontmost.ts   # createFrontmost(run)
  typer.ts       # TYPE_SCRIPT + createTyper(run)
  shifter.ts     # createShifter(deps), ShiftResult
  messages.ts    # describeResult(result)
  hotkeys.ts     # registerGearHotkeys(...)
  main.ts        # Electron glue
test/
  config.test.ts
  typer.test.ts
  frontmost.test.ts
  shifter.test.ts
  messages.test.ts
  hotkeys.test.ts
```

---

### Task 1: Project scaffold, gear defaults, and config loading

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `src/gears.ts`, `src/config.ts`
- Test: `test/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/gears.ts`: `export type GearMap = Record<string, string>`; `export interface Config { gears: GearMap; hotkeyPrefix: string; allowedApps: string[] }`; `export const DEFAULT_CONFIG: Config`.
  - `src/config.ts`: `export const DEFAULT_CONFIG_PATH: string`; `export function validateConfig(value: unknown): Config | null`; `export interface LoadResult { config: Config; warning?: string }`; `export async function loadConfig(path?: string): Promise<LoadResult>`.

- [ ] **Step 1: Create scaffold files**

`package.json`:
```json
{
  "name": "agent-shifter",
  "version": "0.1.0",
  "private": true,
  "description": "Menu bar gear shifter for Claude Code models",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "tsc && electron .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`.gitignore`:
```
node_modules/
dist/
```

Run: `npm install -D typescript electron vitest @types/node`
Expected: installs without errors.

- [ ] **Step 2: Write `src/gears.ts`**

```ts
export type GearMap = Record<string, string>;

export interface Config {
  gears: GearMap;
  hotkeyPrefix: string;
  allowedApps: string[];
}

export const DEFAULT_CONFIG: Config = {
  gears: {
    "1": "claude-haiku-4-5-20251001",
    "2": "claude-sonnet-5-5",
    "3": "claude-opus-5-5",
    "4": "claude-fable-5-1",
  },
  hotkeyPrefix: "Control+Alt",
  allowedApps: ["iTerm2", "Terminal", "nodeterm"],
};
```

- [ ] **Step 3: Write the failing tests `test/config.test.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — cannot resolve `../src/config`.

- [ ] **Step 5: Write `src/config.ts`**

```ts
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
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run test/config.test.ts && npm run typecheck`
Expected: all config tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore src/gears.ts src/config.ts test/config.test.ts
git commit -m "feat: scaffold project and add config loading"
```

---

### Task 2: osascript runner, frontmost app, and typer

**Files:**
- Create: `src/osascript.ts`, `src/frontmost.ts`, `src/typer.ts`
- Test: `test/frontmost.test.ts`, `test/typer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/osascript.ts`: `export type Runner = (args: string[]) => Promise<string>`; `export const runOsascript: Runner` (resolves trimmed stdout, rejects with `Error` whose message is trimmed stderr or the exec error message).
  - `src/frontmost.ts`: `export function createFrontmost(run?: Runner): () => Promise<string>`.
  - `src/typer.ts`: `export const TYPE_SCRIPT: string`; `export const MODIFIERS_HELD_MESSAGE: string`; `export function createTyper(run?: Runner): (text: string) => Promise<void>`.

- [ ] **Step 1: Write `src/osascript.ts`**

```ts
import { execFile } from "node:child_process";

export type Runner = (args: string[]) => Promise<string>;

export const runOsascript: Runner = (args) =>
  new Promise((resolve, reject) => {
    execFile("osascript", args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
```

- [ ] **Step 2: Write the failing tests**

`test/frontmost.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createFrontmost } from "../src/frontmost";

describe("createFrontmost", () => {
  it("asks System Events for the frontmost process name", async () => {
    const calls: string[][] = [];
    const frontmost = createFrontmost(async (args) => {
      calls.push(args);
      return "iTerm2";
    });
    expect(await frontmost()).toBe("iTerm2");
    expect(calls).toEqual([
      ["-e", 'tell application "System Events" to get name of first process whose frontmost is true'],
    ]);
  });

  it("propagates runner errors", async () => {
    const frontmost = createFrontmost(async () => {
      throw new Error("boom");
    });
    await expect(frontmost()).rejects.toThrow("boom");
  });
});
```

`test/typer.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MODIFIERS_HELD_MESSAGE, TYPE_SCRIPT, createTyper } from "../src/typer";

describe("createTyper", () => {
  it("passes the text as an argv value, not inside the script", async () => {
    const calls: string[][] = [];
    const type = createTyper(async (args) => {
      calls.push(args);
      return "ok";
    });
    const nasty = '-x"\\ y';
    await type(nasty);
    expect(calls).toEqual([["-l", "JavaScript", "-e", TYPE_SCRIPT, "--", nasty]]);
    expect(TYPE_SCRIPT).not.toContain(nasty);
  });

  it("waits for modifiers and presses Return in the script", () => {
    expect(TYPE_SCRIPT).toContain("modifierFlags");
    expect(TYPE_SCRIPT).toContain("keyCode(36)");
  });

  it("rejects with a clear message when modifiers stay held", async () => {
    const type = createTyper(async () => "modifiers-held");
    await expect(type("/model x")).rejects.toThrow(MODIFIERS_HELD_MESSAGE);
  });

  it("propagates runner errors", async () => {
    const type = createTyper(async () => {
      throw new Error("not allowed assistive access");
    });
    await expect(type("/model x")).rejects.toThrow("assistive");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/frontmost.test.ts test/typer.test.ts`
Expected: FAIL — cannot resolve `../src/frontmost` / `../src/typer`.

- [ ] **Step 4: Write `src/frontmost.ts`**

```ts
import { Runner, runOsascript } from "./osascript";

const SCRIPT = 'tell application "System Events" to get name of first process whose frontmost is true';

export function createFrontmost(run: Runner = runOsascript): () => Promise<string> {
  return () => run(["-e", SCRIPT]);
}
```

- [ ] **Step 5: Write `src/typer.ts`**

```ts
import { Runner, runOsascript } from "./osascript";

export const MODIFIERS_HELD_MESSAGE = "Release the hotkey keys and try again";

// JXA script. Text arrives as argv[0] so it is never parsed as code.
// Masks: Shift 1<<17, Control 1<<18, Option 1<<19, Command 1<<20.
export const TYPE_SCRIPT = `
function run(argv) {
  ObjC.import("AppKit");
  var mask = (1 << 17) | (1 << 18) | (1 << 19) | (1 << 20);
  var held = function () { return (Number($.NSEvent.modifierFlags) & mask) !== 0; };
  for (var i = 0; i < 30 && held(); i++) delay(0.05);
  if (held()) return "modifiers-held";
  var se = Application("System Events");
  se.keystroke(argv[0]);
  delay(0.1);
  se.keyCode(36);
  return "ok";
}
`;

export function createTyper(run: Runner = runOsascript): (text: string) => Promise<void> {
  return async (text) => {
    // "--" stops osascript option parsing, so text starting with "-" is safe.
    const out = await run(["-l", "JavaScript", "-e", TYPE_SCRIPT, "--", text]);
    if (out === "modifiers-held") throw new Error(MODIFIERS_HELD_MESSAGE);
  };
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run test/frontmost.test.ts test/typer.test.ts && npm run typecheck`
Expected: all PASS; typecheck exits 0.

- [ ] **Step 7: Real-machine smoke check (no typing)**

Run: `npx tsc && node -e 'require("./dist/frontmost").createFrontmost()().then(console.log)'`
Expected: prints the name of the app running the command (e.g. `iTerm2`, `Terminal`, or `nodeterm`).

- [ ] **Step 8: Commit**

```bash
git add src/osascript.ts src/frontmost.ts src/typer.ts test/frontmost.test.ts test/typer.test.ts
git commit -m "feat: add osascript runner, frontmost lookup, and typer"
```

---

### Task 3: Shifter logic and result messages

**Files:**
- Create: `src/shifter.ts`, `src/messages.ts`
- Test: `test/shifter.test.ts`, `test/messages.test.ts`

**Interfaces:**
- Consumes: `Config` from `src/gears.ts`; `MODIFIERS_HELD_MESSAGE` from `src/typer.ts`.
- Produces:
  - `src/shifter.ts`:
    ```ts
    export type ShiftResult =
      | { ok: true; gear: string; model: string }
      | { ok: false; reason: "unknown-gear" | "not-allowed" | "busy" | "error"; detail?: string };
    export interface ShifterDeps {
      config: Config;
      frontmost: () => Promise<string>;
      type: (text: string) => Promise<void>;
      initialGear?: string | null;
    }
    export interface Shifter { shift(gear: string): Promise<ShiftResult>; current(): string | null }
    export function createShifter(deps: ShifterDeps): Shifter;
    ```
  - `src/messages.ts`: `export function describeResult(result: ShiftResult): string | null` (null means no notification).

- [ ] **Step 1: Write the failing tests**

`test/shifter.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../src/gears";
import { createShifter } from "../src/shifter";

function setup(app = "iTerm2") {
  const typed: string[] = [];
  const shifter = createShifter({
    config: DEFAULT_CONFIG,
    frontmost: async () => app,
    type: async (text) => {
      typed.push(text);
    },
  });
  return { shifter, typed };
}

describe("createShifter", () => {
  it("types /model <id> in an allowed app and records the gear", async () => {
    const { shifter, typed } = setup("nodeterm");
    expect(await shifter.shift("2")).toEqual({ ok: true, gear: "2", model: "claude-sonnet-5-5" });
    expect(typed).toEqual(["/model claude-sonnet-5-5"]);
    expect(shifter.current()).toBe("2");
  });

  it("types nothing in an app that is not allowed", async () => {
    const { shifter, typed } = setup("Slack");
    expect(await shifter.shift("2")).toEqual({ ok: false, reason: "not-allowed", detail: "Slack" });
    expect(typed).toEqual([]);
    expect(shifter.current()).toBeNull();
  });

  it("matches app names case-sensitively", async () => {
    const { shifter, typed } = setup("iterm2");
    expect((await shifter.shift("1")).ok).toBe(false);
    expect(typed).toEqual([]);
  });

  it("rejects an unknown gear without checking the app", async () => {
    let asked = false;
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => {
        asked = true;
        return "iTerm2";
      },
      type: async () => {},
    });
    expect(await shifter.shift("9")).toEqual({ ok: false, reason: "unknown-gear", detail: "9" });
    expect(asked).toBe(false);
  });

  it("reports an error when the frontmost lookup fails", async () => {
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => {
        throw new Error("no access");
      },
      type: async () => {},
    });
    expect(await shifter.shift("1")).toEqual({ ok: false, reason: "error", detail: "no access" });
  });

  it("reports an error and keeps the old gear when typing fails", async () => {
    let fail = false;
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "Terminal",
      type: async () => {
        if (fail) throw new Error("typing failed");
      },
    });
    await shifter.shift("1");
    fail = true;
    expect(await shifter.shift("3")).toEqual({ ok: false, reason: "error", detail: "typing failed" });
    expect(shifter.current()).toBe("1");
  });

  it("reports busy for a second shift while one is running", async () => {
    let release!: () => void;
    const typed: string[] = [];
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: (text) =>
        new Promise<void>((resolve) => {
          typed.push(text);
          release = resolve;
        }),
    });
    const first = shifter.shift("3");
    expect(await shifter.shift("3")).toEqual({ ok: false, reason: "busy" });
    await vi.waitFor(() => expect(typed).toHaveLength(1)); // first shift is inside type()
    release();
    expect((await first).ok).toBe(true);
    expect(typed).toEqual(["/model claude-opus-5-5"]);
    // Not busy any more.
    const again = shifter.shift("1");
    await vi.waitFor(() => expect(typed).toHaveLength(2));
    release();
    expect((await again).ok).toBe(true);
  });

  it("starts from initialGear when given", () => {
    const shifter = createShifter({
      config: DEFAULT_CONFIG,
      frontmost: async () => "iTerm2",
      type: async () => {},
      initialGear: "4",
    });
    expect(shifter.current()).toBe("4");
  });
});
```

`test/messages.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/shifter.test.ts test/messages.test.ts`
Expected: FAIL — cannot resolve `../src/shifter` / `../src/messages`.

- [ ] **Step 3: Write `src/shifter.ts`**

```ts
import { Config } from "./gears";

export type ShiftResult =
  | { ok: true; gear: string; model: string }
  | { ok: false; reason: "unknown-gear" | "not-allowed" | "busy" | "error"; detail?: string };

export interface ShifterDeps {
  config: Config;
  frontmost: () => Promise<string>;
  type: (text: string) => Promise<void>;
  initialGear?: string | null;
}

export interface Shifter {
  shift(gear: string): Promise<ShiftResult>;
  current(): string | null;
}

export function createShifter(deps: ShifterDeps): Shifter {
  let current: string | null = deps.initialGear ?? null;
  let busy = false;

  async function shift(gear: string): Promise<ShiftResult> {
    const model = deps.config.gears[gear];
    if (!model) return { ok: false, reason: "unknown-gear", detail: gear };
    // One shift at a time, so keystrokes from two presses never interleave.
    if (busy) return { ok: false, reason: "busy" };
    busy = true;
    try {
      const app = await deps.frontmost();
      if (!deps.config.allowedApps.includes(app)) {
        return { ok: false, reason: "not-allowed", detail: app };
      }
      await deps.type(`/model ${model}`);
      current = gear;
      return { ok: true, gear, model };
    } catch (err) {
      return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = false;
    }
  }

  return { shift, current: () => current };
}
```

- [ ] **Step 4: Write `src/messages.ts`**

```ts
import { ShiftResult } from "./shifter";
import { MODIFIERS_HELD_MESSAGE } from "./typer";

// osascript errors seen when the app lacks Accessibility permission.
const NO_ACCESS = /assistive|-1719|-25211/i;

export function describeResult(result: ShiftResult): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "busy":
      return null;
    case "not-allowed":
      return `Not a terminal: ${result.detail}`;
    case "unknown-gear":
      return `No model set for gear ${result.detail}`;
    case "error":
      if (result.detail && NO_ACCESS.test(result.detail)) {
        return "Grant Accessibility access: System Settings → Privacy & Security → Accessibility";
      }
      if (result.detail === MODIFIERS_HELD_MESSAGE) return result.detail;
      return `Shift failed: ${result.detail}`;
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/shifter.ts src/messages.ts test/shifter.test.ts test/messages.test.ts
git commit -m "feat: add shifter logic and result messages"
```

---

### Task 4: Hotkey registration

**Files:**
- Create: `src/hotkeys.ts`
- Test: `test/hotkeys.test.ts`

**Interfaces:**
- Consumes: `GearMap` from `src/gears.ts`.
- Produces: `export type Register = (accelerator: string, callback: () => void) => boolean`; `export function registerGearHotkeys(gears: GearMap, prefix: string, register: Register, onGear: (gear: string) => void): string[]` — returns the accelerators that failed (register returned false or threw), in gear order.

- [ ] **Step 1: Write the failing test `test/hotkeys.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hotkeys.test.ts`
Expected: FAIL — cannot resolve `../src/hotkeys`.

- [ ] **Step 3: Write `src/hotkeys.ts`**

```ts
import { GearMap } from "./gears";

export type Register = (accelerator: string, callback: () => void) => boolean;

export function registerGearHotkeys(
  gears: GearMap,
  prefix: string,
  register: Register,
  onGear: (gear: string) => void,
): string[] {
  const failed: string[] = [];
  for (const gear of Object.keys(gears).sort()) {
    const accelerator = `${prefix}+${gear}`;
    try {
      // Electron returns false if taken, throws if the accelerator is invalid.
      if (!register(accelerator, () => onGear(gear))) failed.push(accelerator);
    } catch {
      failed.push(accelerator);
    }
  }
  return failed;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/hotkeys.ts test/hotkeys.test.ts
git commit -m "feat: add gear hotkey registration"
```

---

### Task 5: Electron tray app, README, and manual verification

**Files:**
- Create: `src/main.ts`, `README.md`

**Interfaces:**
- Consumes: `loadConfig` (`src/config.ts`), `createFrontmost` (`src/frontmost.ts`), `createTyper` (`src/typer.ts`), `createShifter`, `Shifter` (`src/shifter.ts`), `describeResult` (`src/messages.ts`), `registerGearHotkeys` (`src/hotkeys.ts`), `Config` (`src/gears.ts`).
- Produces: the runnable app (`npm start`).

- [ ] **Step 1: Write `src/main.ts`**

```ts
import { Menu, Notification, Tray, app, globalShortcut, nativeImage } from "electron";
import { loadConfig } from "./config";
import { createFrontmost } from "./frontmost";
import { Config } from "./gears";
import { registerGearHotkeys } from "./hotkeys";
import { describeResult } from "./messages";
import { Shifter, createShifter } from "./shifter";
import { createTyper } from "./typer";

let tray: Tray | null = null;
let config: Config;
let shifter: Shifter;

function notify(body: string): void {
  new Notification({ title: "Agent Shifter", body }).show();
}

function refreshTray(): void {
  if (!tray) return;
  const current = shifter.current();
  tray.setTitle(`⚙ ${current ?? "–"}`);
  const gearItems = Object.keys(config.gears)
    .sort()
    .map((gear) => ({
      label: `${gear}  ${config.gears[gear]}`,
      type: "radio" as const,
      checked: gear === current,
      click: () => void doShift(gear),
    }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...gearItems,
      { type: "separator" },
      { label: "Reload config", click: () => void setup() },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

async function doShift(gear: string): Promise<void> {
  const result = await shifter.shift(gear);
  const message = describeResult(result);
  if (message) notify(message);
  refreshTray();
}

async function setup(): Promise<void> {
  const loaded = await loadConfig();
  config = loaded.config;
  // Keep the shown gear across a config reload.
  const previous = shifter?.current() ?? null;
  shifter = createShifter({
    config,
    frontmost: createFrontmost(),
    type: createTyper(),
    initialGear: previous && config.gears[previous] ? previous : null,
  });

  globalShortcut.unregisterAll();
  const failed = registerGearHotkeys(
    config.gears,
    config.hotkeyPrefix,
    (accelerator, callback) => globalShortcut.register(accelerator, callback),
    (gear) => void doShift(gear),
  );

  if (loaded.warning) notify(loaded.warning);
  for (const accelerator of failed) notify(`Hotkey unavailable: ${accelerator}`);
  refreshTray();
}

app.whenReady().then(async () => {
  app.dock?.hide(); // menu bar only, no Dock icon
  tray = new Tray(nativeImage.createEmpty());
  await setup();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
```

- [ ] **Step 2: Build and run the full test suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck exits 0; all tests PASS; `dist/main.js` exists.

- [ ] **Step 3: Write `README.md`**

````markdown
# Agent Shifter

A menu bar gear shifter for Claude Code models on macOS.

Press a hotkey in a Claude Code session and it types `/model <id>` for you.

## Gears

| Hotkey | Gear | Model |
|--------|------|-------|
| `⌃⌥1` | 1 | `claude-haiku-4-5-20251001` |
| `⌃⌥2` | 2 | `claude-sonnet-5-5` |
| `⌃⌥3` | 3 | `claude-opus-5-5` |
| `⌃⌥4` | 4 | `claude-fable-5-1` |

## Run

```bash
npm install
npm start
```

A `⚙` appears in the menu bar. It shows the last gear you shifted to.

## Permissions

The first shift needs **Accessibility** access.

- Open **System Settings → Privacy & Security → Accessibility**.
- Turn on the app that ran `npm start` (e.g. iTerm2 or Terminal). If macOS lists Electron, turn that on too.

## Config

Edit `~/.config/agent-shifter/config.json`, then click **Reload config** in the menu.

- `gears`: digit `1`–`9` → model id.
- `hotkeyPrefix`: Electron accelerator prefix, default `Control+Alt`.
- `allowedApps`: exact app process names that may receive typing.

## Limits

- Shift with an empty input line. Text already typed gets `/model …` added to it.
- If you run `/model` yourself, the menu bar gear will not know.
````

- [ ] **Step 4: Manual verification**

Run: `npm start`. Then check each item and write down the result:

1. A `⚙ –` title appears in the menu bar; the menu lists gears 1–4, Reload config, Quit.
2. In **iTerm2**, in an idle Claude Code session with an empty input line, press `⌃⌥1`. Claude Code confirms the model changed to Haiku. Tray shows `⚙ 1`. Repeat for gears 2–4.
3. Repeat step 2 in **Terminal** and in **Nodeterm**.
4. Hold `⌃⌥` for about 3 seconds after pressing `⌃⌥2`. Expect nothing typed and a "Release the hotkey keys and try again" notification.
5. Focus a non-terminal app (e.g. Finder) and press `⌃⌥2`. Expect nothing typed and "Not a terminal: Finder".
6. With iTerm2 focused, click gear 3 in the tray menu. Expect the text typed into iTerm2, not lost.
7. Edit config to `"hotkeyPrefix": "Ctrl+Nope"`, click Reload config. Expect "Hotkey unavailable" notifications and the tray menu still working. Restore the config and reload.
8. Check the slash-command menu: after the shift, Claude Code ran `/model <id>` with the full id, not a different autocomplete suggestion.

If step 6 fails (focus moves to the app), stop and report it: the fix is a design change, not a tweak.
If step 8 fails, stop and report it with what Claude Code showed.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts README.md
git commit -m "feat: add Electron tray app and README"
```

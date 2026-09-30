import { Config } from "./gears";
import { FocusChangedError } from "./typer";

export type ShiftResult =
  | { ok: true; gear: string; model: string }
  | { ok: false; reason: "unknown-gear" | "not-allowed" | "busy" | "error"; detail?: string };

export interface ShifterDeps {
  config: Config;
  frontmost: () => Promise<string>;
  type: (text: string, allowedApps: string[]) => Promise<void>;
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
      await deps.type(`/model ${model}`, deps.config.allowedApps);
      current = gear;
      return { ok: true, gear, model };
    } catch (err) {
      if (err instanceof FocusChangedError) return { ok: false, reason: "not-allowed", detail: err.app };
      return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
    } finally {
      busy = false;
    }
  }

  return { shift, current: () => current };
}

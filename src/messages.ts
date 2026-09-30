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

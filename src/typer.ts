import { Runner, runOsascript } from "./osascript";

export const MODIFIERS_HELD_MESSAGE = "Release the hotkey keys and try again";

// Thrown when focus moved to a non-allowed app during the modifier wait.
export class FocusChangedError extends Error {
  constructor(readonly app: string) {
    super(`Focus changed to ${app}`);
  }
}

// JXA script. Text arrives as argv[0] and allowed apps as JSON in argv[1],
// so neither is ever parsed as code.
// Masks: Shift 1<<17, Control 1<<18, Option 1<<19, Command 1<<20.
export const TYPE_SCRIPT = `
function run(argv) {
  ObjC.import("AppKit");
  var mask = (1 << 17) | (1 << 18) | (1 << 19) | (1 << 20);
  var held = function () { return (Number($.NSEvent.modifierFlags) & mask) !== 0; };
  for (var i = 0; i < 30 && held(); i++) delay(0.05);
  if (held()) return "modifiers-held";
  var se = Application("System Events");
  // Re-check focus after the wait, right before typing.
  var app = se.processes.whose({ frontmost: true })[0].name();
  if (JSON.parse(argv[1]).indexOf(app) === -1) return "not-allowed:" + app;
  se.keystroke(argv[0]);
  delay(0.1);
  se.keyCode(36);
  return "ok";
}
`;

export function createTyper(
  run: Runner = runOsascript,
): (text: string, allowedApps: string[]) => Promise<void> {
  return async (text, allowedApps) => {
    // "--" stops osascript option parsing, so text starting with "-" is safe.
    const out = await run(["-l", "JavaScript", "-e", TYPE_SCRIPT, "--", text, JSON.stringify(allowedApps)]);
    if (out === "ok") return;
    if (out === "modifiers-held") throw new Error(MODIFIERS_HELD_MESSAGE);
    if (out.startsWith("not-allowed:")) throw new FocusChangedError(out.slice("not-allowed:".length));
    throw new Error(`Unexpected typer output: ${out}`);
  };
}

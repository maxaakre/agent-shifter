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

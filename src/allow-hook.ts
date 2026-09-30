// Claude Code PreModelSwitch hook. Skips the "switch model?" confirmation,
// but only for switches the shifter announced in its pending note.
// Always exits 0 and prints nothing on doubt, so Claude Code behaves as normal.
import { consumePending } from "./pending";

export const ALLOW_OUTPUT = {
  hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "allow" },
};

export async function decide(
  input: unknown,
  consume: (model: string | null) => Promise<boolean>,
): Promise<typeof ALLOW_OUTPUT | null> {
  if (typeof input !== "object" || input === null) return null;
  const { hook_event_name, source, requested_model } = input as Record<string, unknown>;
  // The shifter types "/model <id>", which Claude Code reports as source "command".
  if (hook_event_name !== "PreModelSwitch" || source !== "command") return null;
  const model = typeof requested_model === "string" ? requested_model : null;
  return (await consume(model)) ? ALLOW_OUTPUT : null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

if (require.main === module) {
  readStdin()
    .then((raw) => decide(JSON.parse(raw), (model) => consumePending(model)))
    .then((out) => {
      if (out) process.stdout.write(JSON.stringify(out));
    })
    .catch(() => {})
    .finally(() => process.exit(0));
}

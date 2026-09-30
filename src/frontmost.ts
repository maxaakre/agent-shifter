import { Runner, runOsascript } from "./osascript";

const SCRIPT = 'tell application "System Events" to get name of first process whose frontmost is true';

export function createFrontmost(run: Runner = runOsascript): () => Promise<string> {
  return () => run(["-e", SCRIPT]);
}

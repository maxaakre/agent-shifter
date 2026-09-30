import { execFile } from "node:child_process";

export type Runner = (args: string[]) => Promise<string>;

export const runOsascript: Runner = (args) =>
  new Promise((resolve, reject) => {
    execFile("osascript", args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });

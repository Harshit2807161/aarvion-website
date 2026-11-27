import { spawn } from "node:child_process";

export interface CommandResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Runs a command without blocking this worker's event loop, and kills it (with its children)
 * after `timeoutMs`.
 *
 * Never use `spawnSync` or `execSync` in a file that runs `startMemoryReplSet`: mongodb-memory-server
 * reads mongod's log from a pipe on this event loop. A synchronous spawn stops that reading, the
 * pipe fills (64 KiB on Linux), mongod blocks on its next log write, and the child it serves
 * times out (`MongoServerSelectionError`) or waits forever; Vitest's test timeout cannot fire
 * while the loop is blocked, so the CI job hung until it was cancelled.
 */
export function runCommand(
  command: string,
  args: string[],
  { env = process.env, timeoutMs = 60_000 }: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    // Own process group, so a timeout kills pnpm and the tsx/node processes under it.
    const child = spawn(command, args, { cwd: process.cwd(), env, detached: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout += d));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        // already exited
      }
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      if (timedOut) stderr += `\n${command} ${args.join(" ")} timed out after ${timeoutMs} ms`;
      resolve({ status: timedOut ? null : status, signal, timedOut, stdout, stderr });
    });
  });
}

/** Runs `pnpm <args>` from the repo root (see `runCommand`). */
export function runPnpm(
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs?: number,
): Promise<CommandResult> {
  return runCommand("pnpm", args, { env, timeoutMs });
}

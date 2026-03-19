import type { Command } from "@oclif/core";

/**
 * Run an oclif command and capture stdout output.
 * Automatically prepends --token test-token to args.
 */
export async function runCommand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Cmd: typeof Command & { run: (argv: string[]) => Promise<any> },
  args: string[] = [],
): Promise<string> {
  const lines: string[] = [];
  // oclif's this.log() calls console.log(), so we intercept that
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    await Cmd.run(["--token", "test-token", ...args]);
  } catch (e: unknown) {
    const err = e as { oclif?: { exit?: number }; code?: string };
    // oclif exit errors (including this.error()) have oclif.exit or code EEXIT
    if (err.oclif?.exit !== undefined || err.code === "EEXIT") {
      // capture the error message if it was logged before throwing
    } else {
      throw e;
    }
  } finally {
    console.log = origLog;
  }
  return lines.join("\n");
}

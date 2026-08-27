/**
 * `stonedog-tests collect --repo <dir>`
 *
 * The inventory goes to stdout so it can be piped or redirected; the report of
 * what was examined goes to stderr so it is visible even when stdout is being
 * captured. A tool whose set size is only visible when you are not using it is
 * a tool whose set size nobody ever sees.
 *
 * This module only EXPORTS. The executable is `bin.ts`, which calls `run`.
 * Keeping them apart means importing `formatReport` in a test cannot
 * accidentally execute the command.
 */

import { writeFile } from "node:fs/promises";

import { collect, CollectError, type CollectReport } from "./collect.js";

export interface Args {
  repo: string;
  project?: string;
  out?: string;
  manifest?: string;
}

export function parseArgs(argv: string[]): Args {
  if (argv[0] !== "collect") {
    throw new CollectError(
      `unknown command "${argv[0] ?? ""}". Usage: stonedog-tests collect --repo <dir>`,
    );
  }
  const args: Partial<Args> = {};
  for (let i = 1; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CollectError(`${flag} needs a value`);
    }
    if (flag === "--repo") args.repo = value;
    else if (flag === "--project") args.project = value;
    else if (flag === "--out") args.out = value;
    else if (flag === "--manifest") args.manifest = value;
    else throw new CollectError(`unknown flag ${flag}`);
    i += 1;
  }
  if (args.repo === undefined) throw new CollectError("--repo is required");
  return args as Args;
}

export function formatReport(project: string, report: CollectReport): string {
  const lines = [
    `${project}: ${report.tiersDeclared} tier(s) declared, ${report.globs} glob(s), ` +
      `${report.filesMatched} file(s) matched`,
  ];
  if (report.uncountedFiles > 0) {
    lines.push(
      `  ${report.uncountedFiles} file(s) in a language with no case counter — ` +
        `their cases report as null, not zero`,
    );
  }
  for (const { file, tiers } of report.ambiguous) {
    lines.push(
      `  AMBIGUOUS: ${file} is claimed by ${tiers.join(" and ")} — it is counted in both`,
    );
  }
  return lines.join("\n");
}

export interface Streams {
  stdout: { write(chunk: string): unknown };
  stderr: { write(chunk: string): unknown };
}

/**
 * Returns the process exit code rather than setting it, so the whole command is
 * testable without spawning a process.
 *
 * An ambiguous file exits non-zero: it is a manifest defect, and a CI step that
 * collects must not report success over a double-counted set.
 */
export async function run(argv: string[], streams: Streams): Promise<number> {
  try {
    const args = parseArgs(argv);
    // Spread rather than `project: args.project`: under
    // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as an
    // absent key, and CollectOptions declares `project?: string`.
    const { inventory, report } = await collect({
      repo: args.repo,
      ...(args.project === undefined ? {} : { project: args.project }),
      ...(args.manifest === undefined ? {} : { manifestPath: args.manifest }),
    });

    const json = `${JSON.stringify(inventory, null, 2)}\n`;
    if (args.out === undefined) streams.stdout.write(json);
    else await writeFile(args.out, json, "utf8");

    streams.stderr.write(`${formatReport(inventory.project, report)}\n`);
    return report.ambiguous.length > 0 ? 1 : 0;
  } catch (error: unknown) {
    const message = error instanceof CollectError ? error.message : String(error);
    streams.stderr.write(`stonedog-tests: ${message}\n`);
    return 2;
  }
}

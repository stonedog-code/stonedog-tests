/**
 * The collector. Node-only: it touches the filesystem and shells out to git.
 *
 * It reports the size of every set it examined. That is not verbosity — a check
 * that passes over nothing is the most common way a green result lies in this
 * fleet, and `0 files over 0 globs` versus `0 files over 6 globs` is exactly
 * that failure wearing a number's clothes.
 */

import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  SCHEMA_VERSION,
  TIERS,
  type Inventory,
  type LanguageCount,
  type Tier,
  type TierReport,
} from "../schema";
import { MANIFEST_FILENAME, readManifest, type TestManifest } from "../manifest";
import { countCases, languageOf } from "../languages";

const execFileAsync = promisify(execFile);

/** What the collector examined, so a caller can print it and a test can assert it. */
export interface CollectReport {
  tiersDeclared: number;
  globs: number;
  filesMatched: number;
  /**
   * Files claimed by more than one tier. A test cannot be both a unit test and
   * an e2e test; overlapping globs double-count and quietly inflate a total, so
   * this is surfaced rather than silently deduped away.
   */
  ambiguous: Array<{ file: string; tiers: Tier[] }>;
  /** Files whose language has no case counter, so `cases` is null for them. */
  uncountedFiles: number;
}

export interface CollectResult {
  inventory: Inventory;
  report: CollectReport;
}

export interface CollectOptions {
  /** The repository root to collect from. */
  repo: string;
  /** Overrides the manifest's `project`. Used when a directory name is the identity. */
  project?: string;
  /**
   * Read the manifest from here instead of `<repo>/stonedog-tests.json`.
   *
   * For trying a candidate manifest against a repository BEFORE committing one
   * to it. Globs are still resolved relative to `repo`, so the numbers are the
   * numbers that repository would report — this changes where the declaration
   * is read from, never what is counted.
   */
  manifestPath?: string;
  /** Injectable so tests do not depend on a clock. */
  now?: () => Date;
}

export class CollectError extends Error {}

export async function collect(options: CollectOptions): Promise<CollectResult> {
  const { repo } = options;
  const now = options.now ?? (() => new Date());

  const manifest = await loadManifest(options.manifestPath ?? join(repo, MANIFEST_FILENAME));
  const project = options.project ?? manifest.project;

  // Pass 1: resolve every declared tier's file set, so overlaps between tiers
  // can be detected before any counting happens.
  const perTier = new Map<Tier, string[]>();
  const claimedBy = new Map<string, Tier[]>();
  let globCount = 0;

  for (const tier of TIERS) {
    const decl = manifest.tiers[tier];
    if (decl === undefined) continue;

    globCount += decl.include.length;
    const files = await resolveGlobs(repo, decl.include, decl.exclude ?? []);
    perTier.set(tier, files);
    for (const file of files) {
      const claims = claimedBy.get(file) ?? [];
      claims.push(tier);
      claimedBy.set(file, claims);
    }
  }

  const ambiguous = [...claimedBy.entries()]
    .filter(([, tiers]) => tiers.length > 1)
    .map(([file, tiers]) => ({ file, tiers }))
    .sort((a, b) => a.file.localeCompare(b.file));

  // Pass 2: count.
  const tiers = {} as Record<Tier, TierReport>;
  let filesMatched = 0;
  let uncountedFiles = 0;

  for (const tier of TIERS) {
    const decl = manifest.tiers[tier];
    if (decl === undefined) {
      tiers[tier] = { declared: false };
      continue;
    }

    const files = perTier.get(tier) ?? [];
    const languages: Record<string, LanguageCount> = {};
    let tierCases: number | null = null;

    for (const relative of files) {
      const language = languageOf(relative);
      const source = await readFile(join(repo, relative), "utf8");
      const cases = countCases(language, source);
      if (cases === null) uncountedFiles += 1;

      const bucket = (languages[language] ??= { files: 0, cases: null });
      bucket.files += 1;
      if (cases !== null) {
        bucket.cases = (bucket.cases ?? 0) + cases;
        tierCases = (tierCases ?? 0) + cases;
      }
    }

    filesMatched += files.length;
    tiers[tier] = {
      declared: true,
      globs: decl.include.length,
      files: files.length,
      cases: tierCases,
      languages,
    };
  }

  return {
    inventory: {
      schemaVersion: SCHEMA_VERSION,
      project,
      generatedAt: now().toISOString(),
      commit: await resolveCommit(repo),
      tiers,
    },
    report: {
      tiersDeclared: perTier.size,
      globs: globCount,
      filesMatched,
      ambiguous,
      uncountedFiles,
    },
  };
}

async function loadManifest(path: string): Promise<TestManifest> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new CollectError(
      `no manifest at ${path}. Tiers are declared, never inferred — add a ` +
        `${MANIFEST_FILENAME} so the counts mean the same thing here as everywhere else.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CollectError(`${path} is not valid JSON: ${(error as Error).message}`);
  }

  const result = readManifest(parsed);
  if (result.status === "unsupported-version") {
    throw new CollectError(
      `${path} declares schemaVersion ${result.version}; this collector understands ${SCHEMA_VERSION}.`,
    );
  }
  if (result.status === "invalid") {
    throw new CollectError(`${path} is not a valid manifest:\n  - ${result.errors.join("\n  - ")}`);
  }
  return result.manifest;
}

async function resolveGlobs(repo: string, include: string[], exclude: string[]): Promise<string[]> {
  const excluded = new Set<string>();
  for (const pattern of exclude) {
    for await (const match of glob(pattern, { cwd: repo })) excluded.add(normalise(match));
  }

  // A Set, because two globs in one tier may legitimately match the same file
  // and that file is still one file.
  const matched = new Set<string>();
  for (const pattern of include) {
    for await (const match of glob(pattern, { cwd: repo })) {
      const file = normalise(match);
      if (!excluded.has(file)) matched.add(file);
    }
  }
  return [...matched].sort();
}

const normalise = (path: string): string => path.split("\\").join("/");

/** Null rather than a throw: a source tree need not be a git checkout. */
async function resolveCommit(repo: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repo, "rev-parse", "HEAD"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

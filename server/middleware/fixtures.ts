/**
 * The dev-server middleware that serves the committed fixtures.
 *
 * This is where a host would instead read its private store — S3, a data repo,
 * a database. It is deliberately the ONLY place in this repository that knows
 * where inventories come from: the components take data as a prop and know
 * nothing about transport, so a host can swap this out without touching them.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

import { log } from "stonedog-logs";

const FIXTURES_DIR = new URL("../../fixtures/", import.meta.url).pathname;

interface Payload {
  /**
   * Every project gets an entry, including one whose document failed to parse.
   * A project that vanishes from this list reads as a project that is fine.
   */
  entries: Array<{ project: string; document: unknown }>;
  /** What the server examined, so the client can render the denominator. */
  examined: { files: number; failed: string[] };
}

export async function readFixtures(dir: string = FIXTURES_DIR): Promise<Payload> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    log.error("fixtures directory unreadable", { dir, error: String(error) });
    return { entries: [], examined: { files: 0, failed: [] } };
  }

  const entries: Payload["entries"] = [];
  const failed: string[] = [];

  for (const name of names) {
    const project = name.replace(/\.json$/, "");
    try {
      entries.push({ project, document: JSON.parse(await readFile(join(dir, name), "utf8")) });
    } catch (error) {
      // A malformed fixture becomes an entry with a null document, which the
      // client renders as "unreadable". Dropping it would be the silent-empty-set
      // failure this whole package is about.
      log.warn("fixture could not be parsed", { name, error: String(error) });
      entries.push({ project, document: null });
      failed.push(name);
    }
  }

  log.info("fixtures read", { files: names.length, entries: entries.length, failed: failed.length });
  return { entries, examined: { files: names.length, failed } };
}

export function fixtureApiPlugin(): Plugin {
  return {
    name: "stonedog-tests-fixture-api",
    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res, next) => {
        if (req.url !== "/api/inventories") {
          next();
          return;
        }
        void readFixtures().then((payload) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        });
      };
      server.middlewares.use(handler);
    },
  };
}

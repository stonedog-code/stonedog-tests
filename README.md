# stonedog-tests

A test-inventory surface for a fleet of repositories: **how many tests each
project has, at which tier, in which language** — collected from repositories
that *declare* their tiers, and rendered as a table you can read in one glance.

It answers the question that otherwise needs eight terminals open:

> Which of our projects has no integration tier at all?

```
project              unit            integration     e2e
stonedog-howto       15 ts            2 ts            2 ts
stonedog-testrunner  25 py            9 py            — none declared
stonedogcode-public  30 ts            4 ts            3 ts
```

## The one idea that makes it trustworthy: projects declare their tiers

**This tool does not guess.** A collector that infers tiers from file paths
produces confident numbers that mean different things in every repository, and
that is worse than no numbers.

So each project commits a `stonedog-tests.json` at its root saying which globs
are which tier:

```json
{
  "schemaVersion": 1,
  "project": "stonedog-howto",
  "tiers": {
    "unit":        { "include": ["src/**/__tests__/**/*.test.ts"] },
    "integration": { "include": ["test/integration/**/*.test.ts"] },
    "e2e":         { "include": ["e2e/**/*.spec.ts"] }
  }
}
```

Three states, and the difference between them is the whole point:

| In the manifest | Means | Renders as |
| --- | --- | --- |
| a tier with globs that match files | this tier exists, here it is | the count |
| a tier with `"include": []` | we have none, **deliberately** | `0 — declared empty` |
| the tier key **absent** | nobody has said | `— none declared` |

A tier that is missing and a tier that is empty are different facts. Collapsing
them into `0` is how a dashboard starts lying: it reports a project as having no
integration tests when nobody ever told it where to look.

## What it counts, and what it refuses to count

**Files always. Cases only where it can count them honestly.**

Counting test *cases* means parsing, and parsing differs per language. Where
there is a counter for the language, you get a number. Where there is not, you
get `null` — rendered as `—`, never as `0`.

| Language | Files | Cases |
| --- | --- | --- |
| TypeScript / JavaScript | ✅ | ✅ `it(` / `test(` at any nesting |
| Python | ✅ | ✅ `def test_*` |
| anything else | ✅ | `null` |

Parameterised cases (`it.each`, `@pytest.mark.parametrize`) count as **one**,
because that is what is written. A count that tried to expand them would be a
different number in every framework and comparable across none.

### These are shape numbers, not a score

The useful reading is the **ratio between tiers** — a fat e2e tier over a hollow
unit tier is an ice-cream cone, and that is visible at a glance. The useful
reading is *not* "project A has 52 and project B has 8, so A is better tested".

Test counts are gameable, and so is coverage percentage. Nothing here ranks
projects by a single number, and nothing should be built on top of it that does.

## Usage

### Collect

```bash
npx @stonedogcode/tests collect --repo ../some-project
```

Reads `../some-project/stonedog-tests.json`, walks the declared globs, and
writes an inventory document to stdout. Every run reports the size of the set it
examined:

```
stonedog-howto: 3 tiers declared, 6 globs, 19 files matched
```

`0 files over 0 globs` and `0 files over 6 globs` are the same output on a
careless tool and completely different facts. This one always says which.

### Render

```tsx
import { FleetTable } from "@stonedogcode/tests/styled";

<FleetTable inventories={inventories} />;
```

The components take data as a prop and know nothing about where it came from —
no fetch, no database, no S3 client. The host supplies the data; this renders it.

### Run the standalone server

```bash
npm install
npm run dev
```

Starts the demo server on the fixtures in `fixtures/`, which are real
inventories collected from public repositories in this organisation. It carries
no private data and needs no credentials.

## Installing it in a host application

This package ships **TypeScript source, not a bundle**, for the same reason
`@stonedogcode/style` does: Panda CSS extracts styles by statically parsing
source at the *consumer's* build, so a pre-bundled `dist` would emit class names
the consumer's Panda never generated a stylesheet for.

So a consumer transpiles it and adds it to its own Panda globs:

```js
// next.config.mjs
transpilePackages: ["@stonedogcode/tests"],
```

```ts
// panda.config.ts
include: [
  "./src/**/*.{ts,tsx}",
  "./node_modules/@stonedogcode/tests/src/**/*.{ts,tsx}",
  "../../node_modules/@stonedogcode/tests/src/**/*.{ts,tsx}",
],
```

**Both `node_modules` paths, deliberately.** npm workspaces hoist, so which one
exists depends on the consuming tree — and a glob that matches nothing fails
silently, rendering components whose class names have no CSS behind them.

## Scope

**In:** the inventory schema, the collector, the React table, the standalone
server.

**Not in, yet:** the per-feature "test in depth" visualisation — unit as the
innermost ring, then integration, then e2e, compared against the test pyramid.
It needs to know what a *feature* is, and that vocabulary belongs to a feature
map, whose schema is not settled. Inventing a second one here would guarantee
they disagree.

**Never in:** anything that reads a private repository. The collector runs
wherever the source is; publishing what it produces is the host's job, and a
test inventory names paths that say where a product is weakly tested.

## Licence

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

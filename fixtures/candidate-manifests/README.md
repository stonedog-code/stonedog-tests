# Candidate manifests

**These are drafts, and they do not belong here permanently.**

A manifest declares which globs are which tier, and that declaration is
per-project knowledge — it belongs in the project, at its root, committed by
whoever owns it. Keeping it here would be this package deciding what another
repository's tests are, which is precisely the guessing the whole design
refuses.

They exist for one reason: the demo fixtures in `../` had to be collected from
**real repositories with real counts**, and none of those repositories has a
manifest yet. Building the table against hand-written mock data instead would
have meant shipping a UI nobody had run against a real inventory.

So each of these is a proposal. When a project adopts one it moves to that
project's root as `stonedog-tests.json`, gets reviewed by the people who know
what those tests actually are, and this copy is deleted.

Collected with:

```bash
npm run collect -- --repo ../<project> --manifest fixtures/candidate-manifests/<project>.json
```

## What each one claims, and what it deliberately leaves undeclared

| project | claims | left undeclared, on purpose |
| --- | --- | --- |
| `stonedog-howto` | all three tiers | — |
| `stonedog-style` | unit, and `.ct.tsx` Playwright component tests as e2e | **integration** — nobody has decided whether these exist |
| `stonedog-testrunner` | unit and integration, from its own `tests/unit` and `tests/integration` split | **e2e** — there is no such directory |
| `diagram-viewer` | unit and e2e | **integration** |

Leaving a tier undeclared is the honest move where the answer is genuinely
unknown. Declaring it empty would be a claim, and it is not this package's claim
to make.

`stonedog-style`'s e2e row is the shakiest of these: Playwright component tests
run a component in a real browser, which is neither obviously e2e nor obviously
unit. It is filed as e2e because it needs a real layout engine, and that is the
line the three-tier vocabulary actually draws — but it is exactly the kind of
call the owning project should overrule.

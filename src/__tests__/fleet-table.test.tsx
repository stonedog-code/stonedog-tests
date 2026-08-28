import * as React from "react";
import { render, screen } from "@testing-library/react";

import { FleetTable } from "../styled/fleet-table";
import { toFleetEntry } from "../fleet";
import { SCHEMA_VERSION, type Inventory, type TierReport } from "../schema";

const counted = (files: number): TierReport => ({
  declared: true,
  globs: 2,
  files,
  cases: files * 3,
  languages: { typescript: { files, cases: files * 3 } },
});

const inventory = (tiers: Inventory["tiers"]): Inventory => ({
  schemaVersion: SCHEMA_VERSION,
  project: "demo",
  generatedAt: "2026-08-27T00:00:00.000Z",
  commit: "abc",
  tiers,
});

describe("FleetTable", () => {
  it("renders a row per project", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry("alpha", inventory({ unit: counted(10), integration: counted(4), e2e: counted(2) })),
          toFleetEntry("beta", inventory({ unit: counted(1), integration: counted(2), e2e: counted(9) })),
        ]}
      />,
    );
    expect(screen.getByTestId("row-alpha")).toBeInTheDocument();
    expect(screen.getByTestId("row-beta")).toBeInTheDocument();
  });

  /**
   * The rule this component exists to keep. A project that published nothing
   * must still be a row — a project that vanishes from the table reads as a
   * project that is fine.
   */
  it("keeps a row for a project that published nothing", () => {
    render(<FleetTable entries={[toFleetEntry("silent", undefined)]} />);
    expect(screen.getByTestId("row-silent")).toBeInTheDocument();
    expect(screen.getByTestId("entry-none")).toHaveTextContent("no inventory published");
  });

  it("distinguishes an unreadable document from an absent one", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry("absent", undefined),
          toFleetEntry("broken", { schemaVersion: 1, project: "" }),
          toFleetEntry("newer", { schemaVersion: 42 }),
        ]}
      />,
    );
    expect(screen.getByTestId("entry-none")).toBeInTheDocument();
    expect(screen.getByTestId("entry-unreadable")).toBeInTheDocument();
    expect(screen.getByTestId("entry-unsupported")).toHaveTextContent("v42");
  });

  it("states how many projects contributed numbers", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry("a", inventory({ unit: counted(1), integration: counted(1), e2e: counted(1) })),
          toFleetEntry("b", undefined),
          toFleetEntry("c", undefined),
        ]}
      />,
    );
    // Without this, a table over one readable project looks exactly like a
    // table over three.
    expect(screen.getByText(/1 of 3 projects reported an inventory/)).toBeInTheDocument();
  });

  it("flags an ice-cream cone and does not flag a pyramid", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry("pyr", inventory({ unit: counted(9), integration: counted(4), e2e: counted(1) })),
          toFleetEntry("cone", inventory({ unit: counted(1), integration: counted(4), e2e: counted(9) })),
        ]}
      />,
    );
    expect(screen.getByTestId("shape-pyramid")).toBeInTheDocument();
    expect(screen.getByTestId("shape-ice-cream-cone")).toBeInTheDocument();
  });

  it("says incomplete rather than guessing a shape from an undeclared tier", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry(
            "partial",
            inventory({ unit: counted(9), integration: { declared: false }, e2e: counted(1) }),
          ),
        ]}
      />,
    );
    expect(screen.getByTestId("shape-incomplete")).toBeInTheDocument();
    expect(screen.queryByTestId("shape-ice-cream-cone")).not.toBeInTheDocument();
  });
});

describe("TierCell, through the table", () => {
  it("shows an undeclared tier as none declared, never as 0", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry(
            "p",
            inventory({ unit: counted(3), integration: { declared: false }, e2e: { declared: false } }),
          ),
        ]}
      />,
    );
    const undeclared = screen.getAllByTestId("tier-undeclared");
    expect(undeclared).toHaveLength(2);
    for (const cell of undeclared) expect(cell).toHaveTextContent("none declared");
  });

  it("shows a declared-empty tier as 0 with the reason", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry(
            "p",
            inventory({
              unit: counted(3),
              integration: { declared: true, globs: 0, files: 0, cases: null, languages: {} },
              e2e: counted(1),
            }),
          ),
        ]}
      />,
    );
    expect(screen.getByTestId("tier-empty")).toHaveTextContent("declared empty");
  });

  it("warns when declared globs matched nothing, which is a manifest defect", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry(
            "p",
            inventory({
              unit: counted(3),
              // Three globs, zero files: someone moved the tests and the
              // manifest still points at where they used to be.
              integration: { declared: true, globs: 3, files: 0, cases: null, languages: {} },
              e2e: counted(1),
            }),
          ),
        ]}
      />,
    );
    expect(screen.getByTestId("tier-empty")).toHaveTextContent("3 globs matched nothing");
  });

  it("renders uncounted cases as an em dash, never as 0", () => {
    render(
      <FleetTable
        entries={[
          toFleetEntry(
            "p",
            inventory({
              unit: { declared: true, globs: 1, files: 4, cases: null, languages: { other: { files: 4, cases: null } } },
              integration: { declared: false },
              e2e: { declared: false },
            }),
          ),
        ]}
      />,
    );
    expect(screen.getByTestId("tier-counted")).toHaveTextContent("cases —");
    expect(screen.getByTestId("tier-counted")).not.toHaveTextContent("0 cases");
  });
});

describe("the test id the design system would otherwise swallow", () => {
  /**
   * A regression test for a real, silent defect found in the browser.
   *
   * `StyledTable` renders `<PandaTableRoot {...props} data-testid="styled-table-root">`
   * — the spread comes FIRST, so a `data-testid` passed by a caller is
   * overwritten. Nothing errors; the attribute is simply gone, and the only
   * symptom is a selector that never matches.
   *
   * Asserted in both directions: the wrapper's id must be present, AND the
   * design system's internal id must still be the one on the table itself, so
   * that if the design system ever stops overwriting, this comment is found
   * rather than quietly becoming wrong.
   */
  it("exposes fleet-table on a wrapper the design system cannot overwrite", () => {
    render(<FleetTable entries={[toFleetEntry("a", undefined)]} />);

    const wrapper = screen.getByTestId("fleet-table");
    expect(wrapper.tagName).toBe("DIV");
    expect(screen.getByTestId("styled-table-root").tagName).toBe("TABLE");
    expect(wrapper).toContainElement(screen.getByTestId("styled-table-root"));
  });
});

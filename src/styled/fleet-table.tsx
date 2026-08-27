/**
 * The fleet table: one row per project, one column per tier.
 *
 * Two rules this component exists to keep:
 *
 *   1. Every project supplied gets a row, including the ones that published
 *      nothing and the ones whose document could not be read. A project that
 *      vanishes from the table reads as a project that is fine.
 *   2. The caption states how many projects contributed numbers. A total over
 *      three readable projects out of nine looks identical to a total over nine
 *      unless the denominator is next to it.
 */

import * as React from "react";
import { StyledTable, StyledTag, StyledText } from "@stonedogcode/style";

import { readableCount, type FleetEntry } from "../fleet.js";
import { shapeOf, TIERS, type Shape } from "../schema.js";
import { TierCell } from "./tier-cell.js";

const COLUMNS = [
  { key: "project", label: "Project" },
  { key: "unit", label: "Unit" },
  { key: "integration", label: "Integration" },
  { key: "e2e", label: "E2E" },
  { key: "shape", label: "Shape" },
];

/**
 * Tones are deliberately flat except for the one shape that names a real
 * problem. Colouring every shape differently turns a descriptive column into a
 * league table, which is the thing this package refuses to be.
 */
const SHAPE_TONE: Record<Shape, "neutral" | "warning"> = {
  pyramid: "neutral",
  "ice-cream-cone": "warning",
  hourglass: "warning",
  flat: "neutral",
  incomplete: "neutral",
};

const SHAPE_LABEL: Record<Shape, string> = {
  pyramid: "pyramid",
  "ice-cream-cone": "ice-cream cone",
  hourglass: "hourglass",
  flat: "flat",
  incomplete: "incomplete",
};

export interface FleetTableProps {
  entries: readonly FleetEntry[];
}

export const FleetTable: React.FC<FleetTableProps> = ({ entries }) => {
  const { readable, total } = readableCount(entries);

  return (
    // A plain <div> carries the test id, not the StyledTable.
    //
    // `StyledTable` renders `<PandaTableRoot {...props} data-testid="styled-table-root">`
    // — the spread comes FIRST, so it overwrites any `data-testid` a caller
    // passes. Labelling the table from here silently does nothing: the
    // attribute is accepted, dropped, and the element is findable only by the
    // design system's own internal id. Measured, not assumed: the rendered DOM
    // carries `styled-table-root` where this component asked for `fleet-table`.
    <div data-testid="fleet-table">
      <StyledTable size="md">
        <StyledTable.Caption>
          <StyledText size="sm" color="fg.muted">
            {`${readable} of ${total} project${total === 1 ? "" : "s"} reported an inventory. `}
            Counts are file counts by tier — a shape, not a score.
          </StyledText>
        </StyledTable.Caption>
        <StyledTable.Body header={<StyledTable.Header columns={COLUMNS} />}>
          {entries.map((entry) => (
            <StyledTable.Row key={entry.project} data-testid={`row-${entry.project}`}>
              <StyledTable.Cell>
                <StyledText size="sm">{entry.project}</StyledText>
              </StyledTable.Cell>
              {entry.status === "ok" ? (
                <>
                  {TIERS.map((tier) => (
                    <StyledTable.Cell key={tier}>
                      <TierCell report={entry.inventory.tiers[tier]} />
                    </StyledTable.Cell>
                  ))}
                  <StyledTable.Cell>
                    {renderShape(shapeOf(entry.inventory))}
                  </StyledTable.Cell>
                </>
              ) : (
                // One cell spanning the tier columns. Splitting the explanation
                // across four cells would repeat it four times and still not say
                // which of the three non-ok states this is.
                <StyledTable.Cell colSpan={4}>{renderProblem(entry)}</StyledTable.Cell>
              )}
            </StyledTable.Row>
          ))}
          </StyledTable.Body>
      </StyledTable>
    </div>
  );
};

function renderShape(shape: Shape): React.ReactNode {
  return (
    <StyledTag tone={SHAPE_TONE[shape]} data-testid={`shape-${shape}`}>
      {SHAPE_LABEL[shape]}
    </StyledTag>
  );
}

function renderProblem(
  entry: Extract<FleetEntry, { status: "none" | "unsupported-version" | "unreadable" }>,
): React.ReactNode {
  switch (entry.status) {
    case "none":
      return (
        <StyledText size="sm" color="fg.muted" data-testid="entry-none">
          no inventory published
        </StyledText>
      );
    case "unsupported-version":
      return (
        <StyledText size="sm" color="fg.muted" data-testid="entry-unsupported">
          {`published schema v${entry.version}; this reader understands v1`}
        </StyledText>
      );
    case "unreadable":
      return (
        <StyledText size="sm" color="fg.muted" data-testid="entry-unreadable">
          {`inventory could not be read: ${entry.reason}`}
        </StyledText>
      );
  }
}

export default FleetTable;

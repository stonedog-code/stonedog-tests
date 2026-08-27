import * as React from "react";
import { StyledBox, StyledHeading, StyledText, StyledVStack } from "@stonedogcode/style";

import { toFleetEntry, type FleetEntry } from "@stonedogcode/tests";
import { FleetTable } from "@stonedogcode/tests/styled";

interface Payload {
  entries: Array<{ project: string; document: unknown }>;
  examined: { files: number; failed: string[] };
}

type State =
  | { status: "loading" }
  | { status: "ready"; entries: FleetEntry[]; examined: Payload["examined"] }
  | { status: "failed"; reason: string };

export const App: React.FC = () => {
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/inventories")
      .then((response) => {
        if (!response.ok) throw new Error(`/api/inventories responded ${response.status}`);
        return response.json() as Promise<Payload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setState({
          status: "ready",
          entries: payload.entries.map(({ project, document }) => toFleetEntry(project, document)),
          examined: payload.examined,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A failed fetch is its own state, never an empty table. An empty table
        // reads as "the fleet has no tests", which is the exact confusion this
        // package exists to prevent.
        setState({ status: "failed", reason: String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StyledBox p={6}>
      <StyledVStack gap="4" alignItems="stretch">
        <StyledHeading>Fleet test inventory</StyledHeading>
        <StyledText size="sm" color="fg.muted">
          Counts are file counts per declared tier. The useful reading is the ratio between
          tiers, not the totals — this is a shape, not a score.
        </StyledText>

        {state.status === "loading" && <StyledText>Loading…</StyledText>}

        {state.status === "failed" && (
          <StyledText data-testid="load-failed">
            {`Could not load inventories: ${state.reason}`}
          </StyledText>
        )}

        {state.status === "ready" && (
          <>
            <FleetTable entries={state.entries} />
            <StyledText size="xs" color="fg.muted" data-testid="examined">
              {`Read ${state.examined.files} fixture file(s)` +
                (state.examined.failed.length > 0
                  ? `; ${state.examined.failed.length} could not be parsed: ${state.examined.failed.join(", ")}`
                  : "")}
            </StyledText>
          </>
        )}
      </StyledVStack>
    </StyledBox>
  );
};

export default App;

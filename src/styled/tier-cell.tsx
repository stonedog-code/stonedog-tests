/**
 * One tier's cell.
 *
 * The whole reason this is a component rather than a template string is that a
 * tier has three states and two of them are easy to render as "0":
 *
 *   undeclared        nobody said where to look   →  "— none declared"
 *   declared, empty   we have none, deliberately  →  "0  declared empty"
 *   declared, files   here they are               →  "15  ts · 132 cases"
 *
 * Rendering the first two identically is what turns an undeclared tier into an
 * accusation.
 */

import * as React from "react";
// From the package root, not a deep path: `@stonedogcode/style`'s exports map
// only publishes ".", "./preset" and "./package.json", so a deep import
// resolves in the editor and fails at runtime under Node's ESM resolver.
import { StyledHStack, StyledTag, StyledText } from "@stonedogcode/style";

import type { LanguageCount, TierReport } from "../schema.js";

const LANGUAGE_LABEL: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  other: "other",
};

export interface TierCellProps {
  report: TierReport | undefined;
}

export const TierCell: React.FC<TierCellProps> = ({ report }) => {
  // `undefined` covers a document that predates a tier being added to the
  // schema, which is indistinguishable from undeclared and is treated as such.
  if (report === undefined || !report.declared) {
    return (
      <StyledText size="sm" color="fg.muted" data-testid="tier-undeclared">
        — none declared
      </StyledText>
    );
  }

  if (report.files === 0) {
    return (
      <StyledHStack gap="2" data-testid="tier-empty">
        <StyledText size="sm">0</StyledText>
        <StyledText size="xs" color="fg.muted">
          {report.globs === 0
            ? "declared empty"
            : `declared empty · ${report.globs} glob${report.globs === 1 ? "" : "s"} matched nothing`}
        </StyledText>
      </StyledHStack>
    );
  }

  return (
    <StyledHStack gap="2" data-testid="tier-counted">
      <StyledText size="sm">{report.files}</StyledText>
      {Object.entries(report.languages)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([language, count]) => (
          <StyledTag key={language} tone="neutral">
            {LANGUAGE_LABEL[language] ?? language}
            {languageDetail(count)}
          </StyledTag>
        ))}
      <StyledText size="xs" color="fg.muted">
        {/* An em dash, never 0: a language with no counter has not been measured. */}
        {report.cases === null ? "cases —" : `${report.cases} cases`}
      </StyledText>
    </StyledHStack>
  );
};

function languageDetail(count: LanguageCount): string {
  return count.files === 1 ? "" : ` ×${count.files}`;
}

export default TierCell;

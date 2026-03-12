import type { PaperDraft, PaperSections } from "@deepscholar/contracts";
import { escapeLatex } from "./latex-escape.ts";

export const VISUALIZATION_SECTION_IDS = [
  "abstract",
  "introduction",
  "relatedWork",
  "methodology",
  "experiments",
  "results",
  "discussion",
  "conclusion",
] as const;

export type VisualizationSectionId = (typeof VISUALIZATION_SECTION_IDS)[number];

type VisualBlockInput = {
  readonly visualId: string;
  readonly caption: string;
  readonly metricNames: readonly string[];
  readonly tableRef: string;
  readonly figureRef: string;
  readonly narrative?: string;
  readonly relativeDir: string;
};

export function requireVisualizationSection(
  value: string | undefined,
): VisualizationSectionId {
  const section = value ?? "results";
  if ((VISUALIZATION_SECTION_IDS as readonly string[]).includes(section)) {
    return section as VisualizationSectionId;
  }
  throw new Error(`section 必须是 ${VISUALIZATION_SECTION_IDS.join("/")}`);
}

function blockMarkers(visualId: string): { readonly begin: string; readonly end: string } {
  return {
    begin: `% DEEPSCHOLAR_VISUAL_BEGIN ${visualId}`,
    end: `% DEEPSCHOLAR_VISUAL_END ${visualId}`,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertVisualBlock(content: string, visualId: string, block: string): string {
  const markers = blockMarkers(visualId);
  const pattern = new RegExp(
    `${escapeRegex(markers.begin)}[\\s\\S]*?${escapeRegex(markers.end)}`,
    "m",
  );
  const trimmed = content.trim();
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }
  return trimmed.length === 0 ? block : `${trimmed}\n\n${block}`;
}

function defaultNarrative(input: VisualBlockInput): string {
  const metricNames = input.metricNames.map(escapeLatex).join(", ");
  const primaryMetric = escapeLatex(input.metricNames[0] ?? "");
  return `Table~\\ref{${input.tableRef}} 汇总了 ${metricNames}，Figure~\\ref{${input.figureRef}} 展示了主指标 ${primaryMetric}。`;
}

function renderVisualBlock(input: VisualBlockInput): string {
  const markers = blockMarkers(input.visualId);
  const message = input.narrative?.trim() || defaultNarrative(input);
  return [
    markers.begin,
    `\\paragraph{${escapeLatex(input.caption)}}`,
    message,
    `\\input{${input.relativeDir}/table.tex}`,
    `\\input{${input.relativeDir}/chart.tex}`,
    markers.end,
  ].join("\n");
}

export function applyVisualizationBlock(
  draft: PaperDraft,
  section: VisualizationSectionId,
  input: VisualBlockInput,
): PaperDraft {
  const block = renderVisualBlock(input);
  const content = upsertVisualBlock(draft.sections[section], input.visualId, block);
  const sections: PaperSections = { ...draft.sections, [section]: content };
  return { ...draft, sections, updatedAt: new Date().toISOString() };
}

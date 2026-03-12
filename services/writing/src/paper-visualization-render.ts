import { escapeLatex } from "./latex-escape.ts";

const METRIC_DECIMALS = 4;
const BAR_WIDTH_PT = 16;
const FIGURE_WIDTH_CM = 11;

export type VisualizationMetricRow = {
  readonly runId: string;
  readonly metrics: Readonly<Record<string, number>>;
};

export type PaperVisualizationSpec = {
  readonly visualId: string;
  readonly metricNames: readonly string[];
  readonly primaryMetric: string;
  readonly caption: string;
  readonly section: string;
  readonly tableRef: string;
  readonly figureRef: string;
  readonly generatedAt: string;
};

function formatMetric(value: number): string {
  return value.toFixed(METRIC_DECIMALS);
}

function axisRange(values: readonly number[]): { readonly min: number; readonly max: number } {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (minValue === maxValue) {
    return { min: Math.min(0, minValue - 1), max: maxValue + 1 };
  }
  const padding = Math.max(Math.abs(maxValue - minValue) * 0.1, 0.1);
  return {
    min: minValue >= 0 ? 0 : minValue - padding,
    max: maxValue + padding,
  };
}

function pgfTickLabels(rows: readonly VisualizationMetricRow[]): string {
  return rows.map((row) => escapeLatex(row.runId)).join(",");
}

function pgfCoordinates(
  rows: readonly VisualizationMetricRow[],
  metricName: string,
): readonly string[] {
  return rows.map((row, index) => `(${index + 1}, ${formatMetric(row.metrics[metricName] ?? 0)})`);
}

export function renderVisualizationTable(
  spec: PaperVisualizationSpec,
  rows: readonly VisualizationMetricRow[],
): string {
  const alignment = ["l", ...spec.metricNames.map(() => "r")].join("");
  const header = ["Run ID", ...spec.metricNames.map((name) => escapeLatex(name))].join(" & ");
  const body = rows.map((row) =>
    [escapeLatex(row.runId), ...spec.metricNames.map((name) => formatMetric(row.metrics[name] ?? 0))]
      .join(" & ")
      .concat(" \\\\"),
  );
  return [
    "\\begin{table}[t]",
    "\\centering",
    `\\begin{tabular}{${alignment}}`,
    "\\toprule",
    `${header} \\\\`,
    "\\midrule",
    ...body,
    "\\bottomrule",
    "\\end{tabular}",
    `\\caption{${escapeLatex(`${spec.caption}（metrics table）`)}}`,
    `\\label{${spec.tableRef}}`,
    "\\end{table}",
    "",
  ].join("\n");
}

export function renderVisualizationChart(
  spec: PaperVisualizationSpec,
  rows: readonly VisualizationMetricRow[],
): string {
  const values = rows.map((row) => row.metrics[spec.primaryMetric] ?? 0);
  const range = axisRange(values);
  const coordinates = pgfCoordinates(rows, spec.primaryMetric).join(" ");
  return [
    "\\begin{figure}[t]",
    "\\centering",
    "\\begin{tikzpicture}",
    "\\begin{axis}[",
    "  ybar,",
    `  bar width=${BAR_WIDTH_PT}pt,`,
    `  width=${FIGURE_WIDTH_CM}cm,`,
    `  ylabel={${escapeLatex(spec.primaryMetric)}},`,
    "  xlabel={Run ID},",
    "  xtick=data,",
    `  xticklabels={${pgfTickLabels(rows)}},`,
    `  ymin=${formatMetric(range.min)},`,
    `  ymax=${formatMetric(range.max)},`,
    "  ymajorgrids=true,",
    "  grid style=dashed,",
    "  enlarge x limits=0.2,",
    "]",
    `\\addplot coordinates {${coordinates}};`,
    "\\end{axis}",
    "\\end{tikzpicture}",
    `\\caption{${escapeLatex(spec.caption)}}`,
    `\\label{${spec.figureRef}}`,
    "\\end{figure}",
    "",
  ].join("\n");
}

export function renderVisualizationScript(): string {
  return [
    "import fs from 'node:fs/promises';",
    "",
    "const spec = JSON.parse(await fs.readFile(new URL('./visual-spec.json', import.meta.url), 'utf8'));",
    "const source = JSON.parse(await fs.readFile(new URL('./source-metrics.json', import.meta.url), 'utf8'));",
    "const escapeLatex = (value) => String(value)",
    "  .replace(/\\\\/g, '\\\\textbackslash{}')",
    "  .replace(/[{}]/g, (match) => `\\\\${match}`)",
    "  .replace(/([#$%&_])/g, '\\\\$1')",
    "  .replace(/\\^/g, '\\\\textasciicircum{}')",
    "  .replace(/~/g, '\\\\textasciitilde{}');",
    "const format = (value) => Number(value).toFixed(4);",
    "const rows = source;",
    "const header = ['Run ID', ...spec.metricNames].map(escapeLatex).join(' & ');",
    "const tableRows = rows.map((row) => [escapeLatex(row.runId), ...spec.metricNames.map((name) => format(row.metrics[name] ?? 0))].join(' & ') + ' \\\\\\\\');",
    "const tableTex = ['\\\\begin{table}[t]','\\\\centering',`\\\\begin{tabular}{${['l', ...spec.metricNames.map(() => 'r')].join('')}}`,'\\\\toprule',`${header} \\\\\\\\`,'\\\\midrule',...tableRows,'\\\\bottomrule','\\\\end{tabular}',`\\\\caption{${escapeLatex(spec.caption + '（metrics table）')}}`,`\\\\label{${spec.tableRef}}`,'\\\\end{table}',''].join('\\n');",
    "const values = rows.map((row) => Number(row.metrics[spec.primaryMetric] ?? 0));",
    "const minValue = Math.min(...values);",
    "const maxValue = Math.max(...values);",
    "const padding = minValue === maxValue ? 1 : Math.max(Math.abs(maxValue - minValue) * 0.1, 0.1);",
    "const ymin = minValue >= 0 ? 0 : minValue - padding;",
    "const ymax = minValue === maxValue ? maxValue + 1 : maxValue + padding;",
    "const coordinates = rows.map((row, index) => `(${index + 1}, ${format(row.metrics[spec.primaryMetric] ?? 0)})`).join(' ');",
    "const ticklabels = rows.map((row) => escapeLatex(row.runId)).join(',');",
    "const chartTex = ['\\\\begin{figure}[t]','\\\\centering','\\\\begin{tikzpicture}','\\\\begin{axis}[','  ybar,','  bar width=16pt,','  width=11cm,',`  ylabel={${escapeLatex(spec.primaryMetric)}},`,'  xlabel={Run ID},','  xtick=data,',`  xticklabels={${ticklabels}},`, `  ymin=${format(ymin)},`, `  ymax=${format(ymax)},`, '  ymajorgrids=true,','  grid style=dashed,','  enlarge x limits=0.2,',']',`\\\\addplot coordinates {${coordinates}};`,'\\\\end{axis}','\\\\end{tikzpicture}',`\\\\caption{${escapeLatex(spec.caption)}}`,`\\\\label{${spec.figureRef}}`,'\\\\end{figure}',''].join('\\n');",
    "await fs.writeFile(new URL('./table.tex', import.meta.url), tableTex, 'utf8');",
    "await fs.writeFile(new URL('./chart.tex', import.meta.url), chartTex, 'utf8');",
    "",
  ].join("\n");
}

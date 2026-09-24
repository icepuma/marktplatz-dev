import { $ } from "bun";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import type { Finding, ScanSummary, Severity } from "./schema";

// Each scanner runs offline, without an LLM and without secrets. Versions are pinned here.

export type ScanResult = { findings: Finding[]; blocked: boolean };

export type Scanner = {
  id: string;
  version: string;
  /** Scans `dir`, writes the raw report to `report`, and returns it as text. */
  run(dir: string, report: string): Promise<string>;
  parse(report: string, dir: string): ScanResult;
};

const BLOCKING: Severity[] = ["critical", "high"];

function severity(value: string): Severity {
  const s = value.toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "info";
}

function relativeFile(file: string | null | undefined, dir: string): string | undefined {
  if (!file) return undefined;
  return isAbsolute(file) ? relative(dir, file) : file;
}

const blocks = (findings: Finding[]) => findings.some((f) => BLOCKING.includes(f.severity));

export const skillspector: Scanner = {
  id: "skillspector",
  version: "2.9.6",
  async run(dir, report) {
    // Exit 1 only means "risky"; the report decides. Exit 2+ is an error.
    const res = await $`uvx --from git+https://github.com/NVIDIA/SkillSpector.git@v${this.version} skillspector scan ${dir} --no-llm --format json --output ${report}`
      .quiet()
      .nothrow();
    if (res.exitCode > 1) throw new Error(`skillspector failed: ${res.stderr.toString()}`);
    return readFile(report, "utf8");
  },
  parse(report, dir) {
    type Issue = { id: string; category: string; severity: string; finding: string; location?: { file?: string; start_line?: number } };
    const data = JSON.parse(report) as {
      execution_successful: boolean;
      risk_assessment: { score: number };
      issues: Issue[];
    };
    if (!data.execution_successful) throw new Error("skillspector did not complete");
    const findings = data.issues.map((i) => ({
      scanner: this.id,
      ruleId: i.id,
      severity: severity(i.severity),
      message: `${i.category}: ${i.finding}`,
      file: relativeFile(i.location?.file, dir),
      line: i.location?.start_line,
    }));
    return { findings, blocked: data.risk_assessment.score > 20 || blocks(findings) };
  },
};

export const ciscoSkillScanner: Scanner = {
  id: "cisco-skill-scanner",
  version: "2.1.0",
  async run(dir, report) {
    await $`uvx --from cisco-ai-skill-scanner==${this.version} skill-scanner scan ${dir} --format json --output-json ${report}`.quiet();
    return readFile(report, "utf8");
  },
  parse(report, dir) {
    type CiscoFinding = { rule_id: string; severity: string; title: string; file_path?: string | null; line_number?: number | null };
    const data = JSON.parse(report) as { findings: CiscoFinding[] };
    const findings = data.findings.map((f) => ({
      scanner: this.id,
      ruleId: f.rule_id,
      severity: severity(f.severity),
      message: f.title,
      file: relativeFile(f.file_path, dir),
      line: f.line_number ?? undefined,
    }));
    return { findings, blocked: blocks(findings) };
  },
};

export const atr: Scanner = {
  id: "atr",
  version: "4.0.0",
  async run(dir, report) {
    // --no-report: ATR uploads scan results to its cloud by default.
    const out = await $`bunx --bun agent-threat-rules@${this.version} scan ${dir} --json --no-report`.quiet().text();
    await writeFile(report, out);
    return out;
  },
  parse(report, dir) {
    type Match = { rule_id: string; title: string; severity: string };
    const data = JSON.parse(report) as { results: { file: string; matches: Match[] }[] };
    const findings = data.results.flatMap((r) =>
      r.matches.map((m) => ({
        scanner: this.id,
        ruleId: m.rule_id,
        severity: severity(m.severity),
        message: m.title,
        file: relativeFile(r.file, dir),
      })),
    );
    return { findings, blocked: blocks(findings) };
  },
};

export const SCANNERS: Scanner[] = [skillspector, ciscoSkillScanner, atr];

/** Runs every scanner on `dir`, writes raw reports and summary.json into `outDir`. */
export async function scanSkill(dir: string, outDir: string, scanners = SCANNERS): Promise<ScanSummary> {
  await mkdir(outDir, { recursive: true });
  const runs = await Promise.all(
    scanners.map(async (scanner) => {
      const report = await scanner.run(dir, join(outDir, `${scanner.id}.json`));
      return { scanner, ...scanner.parse(report, dir) };
    }),
  );
  const summary: ScanSummary = {
    passed: runs.every((r) => !r.blocked),
    scanners: runs.map((r) => ({ id: r.scanner.id, version: r.scanner.version, blocked: r.blocked })),
    findings: runs.flatMap((r) => r.findings),
  };
  await writeFile(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

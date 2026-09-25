import { z } from "zod";

// agentskills.io name rules: lowercase alphanumerics and single hyphens, max 64 chars.
export const SkillId = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase letters, digits and single hyphens");

// The exact git tag. Also used as a directory name, so no slashes.
export const Version = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/, "must be a plain git tag");

export const QuarantineManifest = z.strictObject({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must be owner/repo"),
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "must be a relative path inside the repo"),
  version: Version,
});
export type QuarantineManifest = z.infer<typeof QuarantineManifest>;

export const Role = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  skills: z.array(SkillId).min(1),
});
export type Role = z.infer<typeof Role>;

// SKILL.md frontmatter. Harnesses add their own keys, so unknown keys are allowed.
export const SkillFrontmatter = z.looseObject({
  name: SkillId,
  description: z.string().trim().min(1).max(1024),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.strictObject({
  scanner: z.string(),
  ruleId: z.string(),
  severity: Severity,
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().optional(),
});
export type Finding = z.infer<typeof Finding>;

export const ScannerRun = z.strictObject({
  id: z.string(),
  version: z.string(),
  blocked: z.boolean(),
});

export const ScanSummary = z.strictObject({
  passed: z.boolean(),
  scanners: z.array(ScannerRun),
  findings: z.array(Finding),
});
export type ScanSummary = z.infer<typeof ScanSummary>;

export const Provenance = z.strictObject({
  id: SkillId,
  repo: z.string(),
  path: z.string(),
  version: Version,
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  contentHash: z.string().regex(/^sha256-[0-9a-f]{64}$/),
  license: z.string().min(1),
  promotedAt: z.iso.datetime(),
});
export type Provenance = z.infer<typeof Provenance>;

// A skill held at the gate: checked, but not cleared. Only its provenance and scan are kept, never its files, so
// the SKILL.md description is recorded here.
export const Held = Provenance.extend({ description: z.string().trim().min(1).max(1024) });
export type Held = z.infer<typeof Held>;

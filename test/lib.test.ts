import { describe, expect, test } from "bun:test";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateLicense } from "../src/lib/license";
import { QuarantineManifest, Role } from "../src/lib/schema";
import { contentHash, validateSkillDir } from "../src/lib/skill";

async function skillDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skill-"));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return dir;
}

const skillMd = (name: string) => `---\nname: ${name}\ndescription: Does a thing.\n---\n\n# ${name}\n`;

describe("schemas", () => {
  test("quarantine manifest needs exactly repo, path, version", () => {
    expect(QuarantineManifest.safeParse({ repo: "a/b", path: "skills/x", version: "v1.0.0" }).success).toBe(true);
    expect(QuarantineManifest.safeParse({ repo: "a/b", path: "skills/x", version: "v1", ref: "main" }).success).toBe(false);
    expect(QuarantineManifest.safeParse({ repo: "a/b", path: "../x", version: "v1" }).success).toBe(false);
    expect(QuarantineManifest.safeParse({ repo: "a/b", path: "x", version: "feature/x" }).success).toBe(false);
  });

  test("roles reference valid skill ids", () => {
    expect(Role.safeParse({ name: "SRE", description: "d", skills: ["ponytail"] }).success).toBe(true);
    expect(Role.safeParse({ name: "SRE", description: "d", skills: ["Not_Valid"] }).success).toBe(false);
    expect(Role.safeParse({ name: "SRE", description: "d", skills: [] }).success).toBe(false);
  });
});

describe("license", () => {
  const response = (spdx: string | null) => ({
    license: spdx === null ? null : { spdx_id: spdx },
    content: Buffer.from("license text").toString("base64"),
    encoding: "base64",
  });

  test("accepts a recognized SPDX license", () => {
    expect(evaluateLicense(response("MIT"))).toEqual({ spdx: "MIT", text: "license text" });
  });

  test("rejects a missing or unrecognized license", () => {
    expect(() => evaluateLicense(null)).toThrow("no license");
    expect(() => evaluateLicense(response("NOASSERTION"))).toThrow("not a recognized");
    expect(() => evaluateLicense(response(null))).toThrow("not a recognized");
  });
});

describe("skill directory", () => {
  test("accepts a valid skill", async () => {
    const dir = await skillDir({ "SKILL.md": skillMd("demo") });
    expect((await validateSkillDir(dir, "demo")).name).toBe("demo");
  });

  test("rejects a name mismatch", async () => {
    const dir = await skillDir({ "SKILL.md": skillMd("other") });
    await expect(validateSkillDir(dir, "demo")).rejects.toThrow('must equal "demo"');
  });

  test("rejects a missing SKILL.md", async () => {
    const dir = await skillDir({ "README.md": "hi" });
    await expect(validateSkillDir(dir, "demo")).rejects.toThrow("SKILL.md is missing");
  });

  test("rejects symlinks", async () => {
    const dir = await skillDir({ "SKILL.md": skillMd("demo") });
    await symlink("/etc/passwd", join(dir, "passwd"));
    await expect(validateSkillDir(dir, "demo")).rejects.toThrow("symlinks are not allowed");
  });

  test("content hash depends on paths and contents", async () => {
    const a = await contentHash(await skillDir({ "SKILL.md": skillMd("demo") }));
    const b = await contentHash(await skillDir({ "SKILL.md": skillMd("demo") }));
    const c = await contentHash(await skillDir({ "SKILL.md": skillMd("demo"), "x.txt": "" }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^sha256-[0-9a-f]{64}$/);
  });
});

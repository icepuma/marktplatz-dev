import { useState } from "react";

// Requesting a skill is a pull request that adds quarantine/<id>.yaml; this fills it in on GitHub for you.

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function RequestForm({ repo }: { repo: string }) {
  const [source, setSource] = useState("");
  const [path, setPath] = useState("");
  const [version, setVersion] = useState("");
  const [id, setId] = useState("");
  const name = id || path.split("/").filter(Boolean).at(-1) || "";
  const ok = REPO_RE.test(source) && path.trim() !== "" && version.trim() !== "" && ID_RE.test(name);
  const yaml = `repo: ${source}\npath: ${path.trim()}\nversion: ${version.trim()}\n`;
  const filename = `quarantine/${name || "<name>"}.yaml`;
  const href = `https://github.com/${repo}/new/main/quarantine?filename=${encodeURIComponent(`${name}.yaml`)}&value=${encodeURIComponent(yaml)}`;

  return (
    <form className="panel stack" onSubmit={(e) => e.preventDefault()}>
      <label className="field">
        <span>Repository</span>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value.trim())} placeholder="owner/repo" spellCheck={false} />
      </label>
      <label className="field">
        <span>Folder with the SKILL.md</span>
        <input className="input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="skills/my-skill" spellCheck={false} />
      </label>
      <label className="field">
        <span>Exact git tag</span>
        <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.2.0" spellCheck={false} />
      </label>
      <label className="field">
        <span>Skill name</span>
        <input className="input" value={id} onChange={(e) => setId(e.target.value.trim())} placeholder={name || "my-skill"} spellCheck={false} />
      </label>
      <div className="code">
        <div className="code-head">
          <span className="mono">{filename}</span>
        </div>
        <pre>{yaml}</pre>
      </div>
      {ok ? (
        <a className="btn btn-primary btn-block" href={href} rel="noopener">
          Open the request on GitHub
        </a>
      ) : (
        <button type="button" className="btn btn-primary btn-block" disabled>
          Fill in the repository, folder and tag
        </button>
      )}
    </form>
  );
}

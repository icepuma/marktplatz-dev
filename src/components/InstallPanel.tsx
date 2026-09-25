import { useEffect, useId, useState } from "react";
import { type EmitContext, emitters, type Harness, heldRules, type Picked } from "@/lib/emitters";
import type { Catalog } from "@/lib/types";

export type InstallTab = Harness | "agent";

const TABS: [InstallTab, string][] = [
  ["claude-code", emitters["claude-code"].label],
  ["codex", emitters.codex.label],
  ["agent", "Ask thy agent"],
];
const STORE = "marktplatz-install-tab";
const COPIED_FOR = 2000; // ms the Copy button says "Copied"
const NAMED = 3; // up to this many skills not cleared are named in the warning; more are counted

function download(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  Object.assign(document.createElement("a"), { href: url, download: "marketplace.json" }).click();
  URL.revokeObjectURL(url);
}

/**
 * How to get skills home. Every harness reads its own flavour of marketplace file, so each harness tab writes that
 * harness's file and the commands to put it in place and install from it. "Ask thy agent" hands over a prompt to
 * review the skills first. Remembers the last tab (per browser); the shop controls it through the URL.
 */
export default function InstallPanel({
  catalog,
  picked,
  ctx,
  subject,
  page,
  tab: controlled,
  onTab,
  onDone,
}: {
  catalog: Catalog;
  picked: Picked;
  ctx: EmitContext;
  /** What is being installed, for the review prompt: "ponytail", "the Platform Engineer guild". */
  subject: string;
  /** The page describing it, for the review prompt. */
  page: string;
  tab?: InstallTab;
  onTab?: (tab: InstallTab) => void;
  onDone?: (what: "downloaded" | "copied") => void;
}) {
  const [own, setOwn] = useState<InstallTab>("claude-code");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<InstallTab | null>(null);
  const tab = controlled ?? own;
  const ids = useId();

  useEffect(() => {
    setOrigin(location.origin);
    if (controlled) return;
    try {
      const saved = localStorage.getItem(STORE) as InstallTab | null;
      if (saved && TABS.some(([id]) => id === saved)) setOwn(saved);
    } catch {}
  }, [controlled]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_FOR);
    return () => clearTimeout(timer);
  }, [copied]);

  const choose = (next: InstallTab) => {
    setCopied(null);
    if (onTab) onTab(next);
    else setOwn(next);
    try {
      localStorage.setItem(STORE, next);
    } catch {}
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(tab);
    onDone?.("copied");
  };

  const file = tab === "agent" ? null : emitters[tab].emit(catalog, picked, ctx);
  const text = file
    ? file.install.join("\n")
    : [
        `Before I install ${subject} from marktplatz, review it for me.`,
        `Read ${origin}${page} and the SKILL.md files it links, pinned at commit ${ctx.sha.slice(0, 12)} of ${ctx.repoUrl.replace(/\.git$/, "")}.`,
        "Tell me what it does, which files and scripts it brings, and anything that looks risky.",
        ...(picked.held.length
          ? [
              `Warning: ${picked.held.map((h) => h.id).join(", ")} did not clear the marktplatz watch and would come straight from their own repositories, unreviewed by the market.`,
              `Read the findings at ${origin}/ledger#gate, show me each one, and do not install them unless I say so after that.`,
            ]
          : []),
      ].join("\n");

  const empty = picked.guilds.length + picked.skills.length + picked.held.length === 0;
  return (
    <div className="stack install">
      <div className="segments" role="tablist" aria-label="Install for">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${ids}-${id}`}
            aria-selected={tab === id}
            aria-controls={`${ids}-panel`}
            className="segment"
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stack install-body" role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
        {empty ? (
          <p className="fine">Nothing to install yet. Pick a guild or a skill first.</p>
        ) : (
          <>
            {picked.held.length > 0 && (
              <div className="note note-danger" role="note">
                {picked.held.length > NAMED ? (
                  <strong>{picked.held.length} of these skills are not cleared by the watch.</strong>
                ) : (
                  <>
                    <strong>Not cleared by the watch:</strong>{" "}
                    {picked.held.map((h, i) => (
                      <span key={h.id}>
                        {i > 0 && ", "}
                        <a href={`/ledger#held-${h.id}`} title={heldRules(h).join(", ")}>
                          {h.id}
                        </a>
                      </span>
                    ))}
                    .
                  </>
                )}{" "}
                They come straight from their own repositories, unreviewed by the market. <a href="/ledger#gate">Read the findings</a> before you
                install them.
              </div>
            )}
            {file && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  download(file.content);
                  onDone?.("downloaded");
                }}
              >
                Download marketplace.json
              </button>
            )}
            <div className={file ? "code" : "code code-wrap"}>
              <div className="code-head">
                <span>{file ? "Then run, where you saved it" : "Give thy agent this prompt"}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(text)}>
                  {copied === tab ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>{text}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

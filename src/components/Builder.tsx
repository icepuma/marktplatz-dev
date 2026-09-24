import { useEffect, useMemo, useState } from "react";
import { type EmitContext, emitters, type Harness, resolveSelection } from "@/lib/emitters";
import { parseSelectionPath, type Selection, selectionPath } from "@/lib/selection";
import type { Catalog } from "@/lib/types";

type Props = { catalog: Catalog; ctx: EmitContext };

// Point-and-click verbs, in the spirit of early-90s adventure games.
const VERBS = ["Look at", "Pick up", "Drop", "Talk to"] as const;
type Verb = (typeof VERBS)[number];

type Thing = { kind: "guild" | "ware"; id: string; name: string; description: string };

const add = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);
const remove = (list: string[], id: string) => list.filter((x) => x !== id);

export default function Builder({ catalog, ctx }: Props) {
  const [selection, setSelection] = useState<Selection>({ roles: [], skills: [], harness: "claude-code" });
  const [hydrated, setHydrated] = useState(false);
  const [verb, setVerb] = useState<Verb>("Pick up");
  const [hover, setHover] = useState<Thing | null>(null);
  const [message, setMessage] = useState("Welcome, traveller! Pick up some wares, or join a guild.");

  useEffect(() => {
    const load = () => setSelection(parseSelectionPath(location.pathname));
    load();
    setHydrated(true);
    window.addEventListener("popstate", load);
    return () => window.removeEventListener("popstate", load);
  }, []);
  useEffect(() => {
    const path = selectionPath(selection);
    if (hydrated && path !== location.pathname) history.replaceState(null, "", path);
  }, [selection, hydrated]);

  const selected = useMemo(() => resolveSelection(catalog, selection.roles, selection.skills), [catalog, selection]);
  const emitted = emitters[selection.harness].emit(selected, ctx);
  const inBasket = (thing: Thing) =>
    thing.kind === "guild" ? selection.roles.includes(thing.id) : selected.some((s) => s.id === thing.id);

  function act(thing: Thing) {
    const key = thing.kind === "guild" ? "roles" : "skills";
    switch (verb) {
      case "Look at":
        location.href = thing.kind === "guild" ? `/roles/${thing.id}` : `/skills/${thing.id}`;
        return;
      case "Pick up":
        setSelection((s) => ({ ...s, [key]: add(s[key], thing.id) }));
        setMessage(thing.kind === "guild" ? `Thou hast joined the ${thing.name} guild.` : `Thou hast picked up ${thing.name}.`);
        return;
      case "Drop":
        if (thing.kind === "ware" && !selection.skills.includes(thing.id) && inBasket(thing)) {
          setMessage(`${thing.name} came with a guild. Leave the guild to drop it.`);
          return;
        }
        setSelection((s) => ({ ...s, [key]: remove(s[key], thing.id) }));
        setMessage(thing.kind === "guild" ? `Thou hast left the ${thing.name} guild.` : `Thou hast dropped ${thing.name}.`);
        return;
      case "Talk to":
        setMessage(`“${thing.description}”`);
        return;
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([emitted.content], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: "marketplace.json" }).click();
    URL.revokeObjectURL(url);
    setMessage(`Thou hast received a scroll for ${emitters[selection.harness].label}. Speak the words below!`);
  }

  const itemProps = (thing: Thing) => ({
    onClick: () => act(thing),
    onMouseEnter: () => setHover(thing),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(thing),
    onBlur: () => setHover(null),
    "aria-pressed": inBasket(thing),
    "aria-label": `${verb} ${thing.name}`,
  });

  const guilds: Thing[] = catalog.roles.map((r) => ({ kind: "guild", id: r.id, name: r.name, description: r.description }));
  const wares: Thing[] = catalog.skills.map((s) => ({ kind: "ware", id: s.id, name: s.id, description: s.description }));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="adventure-heading">The guild hall</h2>
        <div className="flex flex-wrap gap-6">
          {guilds.map((g) => (
            <button key={g.id} type="button" className="item" {...itemProps(g)}>
              <img src={`/art/guilds/${g.id}.png`} alt="" width={96} height={112} className="pixel" />
              <span className="item-name">{g.name}</span>
              <span className="item-meta">{catalog.roles.find((r) => r.id === g.id)?.skills.length ?? 0} wares</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="adventure-heading">The wares</h2>
        <div className="flex flex-wrap gap-6">
          {wares.map((w) => {
            const skill = catalog.skills.find((s) => s.id === w.id)!;
            return (
              <button key={w.id} type="button" className="item" {...itemProps(w)}>
                <span className="slot">
                  <img src={`/art/wares/${w.id}.png`} alt="" width={64} height={64} className="pixel" />
                </span>
                <span className="item-name">{w.name}</span>
                <span className="item-meta">
                  {skill.version} · {skill.license}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* The adventure-game interface: sentence line, verbs, inventory and the scroll. */}
      <section className="adventure-panel">
        <p className="sentence" aria-live="polite">
          {hover ? `${verb} ${hover.name}` : message}
        </p>
        <div className="panel-grid">
          <div className="verbs" role="radiogroup" aria-label="Verb">
            {VERBS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={verb === v} className="verb" onClick={() => setVerb(v)}>
                {v}
              </button>
            ))}
          </div>

          <div className="inventory" aria-label="Thy basket">
            {selected.map((s) => {
              const thing: Thing = { kind: "ware", id: s.id, name: s.id, description: s.description };
              return (
                <button key={s.id} type="button" className="slot slot-small" title={s.id} {...itemProps(thing)}>
                  <img src={`/art/wares/${s.id}.png`} alt={s.id} width={64} height={64} className="pixel" />
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, 8 - selected.length) }, (_, i) => (
              <span key={`empty-${i}`} className="slot slot-small" aria-hidden="true" />
            ))}
          </div>

          <div className="scroll">
            <div className="harness" role="radiogroup" aria-label="Harness">
              {(Object.keys(emitters) as Harness[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={selection.harness === h}
                  className="verb"
                  onClick={() => setSelection((s) => ({ ...s, harness: h }))}
                >
                  {emitters[h].label}
                </button>
              ))}
            </div>
            <button type="button" className="take-scroll" onClick={download} disabled={selected.length === 0}>
              Take the scroll
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="adventure-heading">Then speak these words</h2>
        <p className="text-muted-foreground">
          {selected.length} ware{selected.length === 1 ? "" : "s"} in thy basket, each sealed to commit{" "}
          <code>{ctx.sha.slice(0, 7)}</code> of the market ledger. Save the scroll as <code>marketplace.json</code>, then:
        </p>
        <pre className="overflow-x-auto bg-muted p-3">{emitted.install.join("\n")}</pre>
        <details>
          <summary className="cursor-pointer font-heading">Unroll the scroll</summary>
          <pre className="mt-3 max-h-96 overflow-auto bg-muted p-3">{emitted.content}</pre>
        </details>
      </section>
    </div>
  );
}

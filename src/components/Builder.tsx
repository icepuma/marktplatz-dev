import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import FilterMenu, { ChoiceMenu, type FilterOption } from "@/components/FilterMenu";
import InstallPanel, { type InstallTab } from "@/components/InstallPanel";
import {
  author,
  licenseName,
  facetCounts,
  filterGuilds,
  filterSkills,
  guildEntries,
  NO_FILTERS,
  nameScore,
  type SkillFacet,
  type SkillFilters,
  skillEntries,
  words,
} from "@/lib/browse";
import { type EmitContext, pick, resolveSelection } from "@/lib/emitters";
import { parseSelectionPath, type Selection, selectionPath } from "@/lib/selection";
import type { Catalog } from "@/lib/types";

type Props = { catalog: Catalog; ctx: EmitContext };
type Tab = "guilds" | "skills";
type Sort = "match" | "name" | "newest" | "size";

const PAGE = 40; // rows rendered at a time; more appear as you scroll
const SAVED = "marktplatz-scroll"; // sessionStorage: the scroll's path, so leaving the shop and coming back keeps it
const TAGS = 6; // skill names shown in a guild row
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const without = (list: string[], ids: Iterable<string>) => {
  const drop = new Set(ids);
  return list.filter((x) => !drop.has(x));
};
const including = (list: string[], ids: Iterable<string>) => [...new Set([...list, ...ids])];
const facetLabels: Record<SkillFacet, string> = { guilds: "Guild", licenses: "Charter", authors: "Crafter" };

/** Marks where the search words appear in a name. */
function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const lower = text.toLowerCase();
  const marks = new Array<boolean>(text.length).fill(false);
  for (const t of terms) for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + 1)) marks.fill(true, i, i + t.length);
  const parts: ReactNode[] = [];
  for (let i = 0; i < text.length; ) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    parts.push(marks[i] ? <mark key={i}>{text.slice(i, j)}</mark> : text.slice(i, j));
    i = j;
  }
  return parts;
}

/**
 * The selection to start from: the URL path, or at "/" the scroll saved in this tab's session. Other pages add to
 * it with `?add=skill:<id>` or `?add=guild:<id>` (repeatable, or comma-separated), and `&held=1` turns on the
 * at-the-gate opt-in.
 */
function initialSelection(catalog: Catalog): { selection: Selection; addedTo: boolean } {
  let selection = parseSelectionPath(location.pathname);
  if (location.pathname === "/") {
    try {
      const saved = sessionStorage.getItem(SAVED);
      if (saved) selection = parseSelectionPath(saved);
    } catch {}
  }
  const params = new URLSearchParams(location.search);
  const adds = params.getAll("add").flatMap((a) => a.split(","));
  const known = { skill: new Set([...catalog.skills, ...catalog.held].map((s) => s.id)), guild: new Set(catalog.roles.map((r) => r.id)) };
  for (const add of adds) {
    const [kind, id] = add.split(":");
    if (!id) continue;
    if (kind === "skill" && known.skill.has(id)) selection = { ...selection, skills: including(selection.skills, [id]) };
    if (kind === "guild" && known.guild.has(id)) selection = { ...selection, roles: including(selection.roles, [id]) };
  }
  if (params.get("held") === "1") selection = { ...selection, held: true };
  return { selection, addedTo: params.has("add") || params.has("held") };
}

// The shop. Built for catalogs of hundreds of skills and dozens of guilds: search first (press "/"), a few filters
// with counts, applied filters as removable chips, dense rows that each go in or out of the scroll with one click,
// bulk add/remove for what is shown, and the scroll alongside with the install commands for each harness.
export default function Builder({ catalog, ctx }: Props) {
  const [selection, setSelection] = useState<Selection>({ roles: [], skills: [], harness: "claude-code", held: false });
  const [hydrated, setHydrated] = useState(false);
  const [done, setDone] = useState<"downloaded" | "copied" | null>(null);
  const [asking, setAsking] = useState(false); // the "Ask thy agent" tab, which the URL does not keep
  const [scrollInView, setScrollInView] = useState(false);

  const [tab, setTab] = useState<Tab>(catalog.roles.length ? "guilds" : "skills");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SkillFilters>(NO_FILTERS);
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState<Sort>("match");
  const [limit, setLimit] = useState(PAGE);
  const search = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const { selection: start, addedTo } = initialSelection(catalog);
    setSelection(start);
    if (addedTo) history.replaceState(null, "", selectionPath(start) + location.hash);
    setHydrated(true);
    const load = () => setSelection(parseSelectionPath(location.pathname));
    window.addEventListener("popstate", load);
    return () => window.removeEventListener("popstate", load);
  }, [catalog]);
  useEffect(() => {
    if (!hydrated) return;
    const path = selectionPath(selection);
    if (path !== location.pathname) history.replaceState(null, "", path);
    try {
      if (selection.roles.length || selection.skills.length) sessionStorage.setItem(SAVED, path);
      else sessionStorage.removeItem(SAVED);
    } catch {}
  }, [selection, hydrated]);
  useEffect(() => {
    // The bar at the bottom is only needed while the scroll itself is out of view.
    const panel = document.getElementById("scroll");
    if (!panel) return;
    const observer = new IntersectionObserver(([entry]) => setScrollInView(entry!.isIntersecting), { threshold: 0 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // "/" jumps to the search box, as on many catalog sites.
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => words(deferredQuery), [deferredQuery]);
  const skills = useMemo(() => skillEntries(catalog, selection.held), [catalog, selection.held]);
  const guilds = useMemo(() => guildEntries(catalog), [catalog]);

  const selected = useMemo(() => resolveSelection(catalog, selection.roles, selection.skills), [catalog, selection]);
  const picked = useMemo(() => pick(catalog, selection.roles, selection.skills, selection.held), [catalog, selection]);
  const inScroll = useMemo(() => new Set([...selected, ...picked.held].map((s) => s.id)), [selected, picked]);
  const scrollCount = selected.length + picked.held.length;

  // What each tab shows. Both lists are always computed, so the tab counts are the result counts.
  const skillResults = useMemo(() => {
    let list = filterSkills(skills, terms, filters);
    if (mine) list = list.filter((e) => inScroll.has(e.skill.id));
    const byName = (a: (typeof list)[number], b: (typeof list)[number]) => a.skill.id.localeCompare(b.skill.id);
    if (sort === "newest") return [...list].sort((a, b) => b.skill.promotedAt.localeCompare(a.skill.promotedAt));
    if (sort === "match" && terms.length) return [...list].sort((a, b) => nameScore(b.skill.id, terms) - nameScore(a.skill.id, terms) || byName(a, b));
    return [...list].sort(byName);
  }, [skills, terms, filters, mine, inScroll, sort]);
  const guildResults = useMemo(() => {
    let list = filterGuilds(guilds, terms);
    if (mine) list = list.filter((e) => selection.roles.includes(e.role.id));
    const byName = (a: (typeof list)[number], b: (typeof list)[number]) => a.role.name.localeCompare(b.role.name);
    if (sort === "size") return [...list].sort((a, b) => b.role.skills.length - a.role.skills.length || byName(a, b));
    if (sort === "match" && terms.length) return [...list].sort((a, b) => nameScore(b.role.name, terms) - nameScore(a.role.name, terms) || byName(a, b));
    return [...list].sort(byName);
  }, [guilds, terms, mine, selection.roles, sort]);
  const shownCount = tab === "skills" ? skillResults.length : guildResults.length;
  const total = tab === "skills" ? skills.length : guilds.length;
  const noun = tab === "skills" ? "skill" : "guild";

  // Facet options with the count each would give. Facets apply to skills only, and are cleared on leaving that tab.
  const facetOptions = (facet: SkillFacet, all: { value: string; label: string }[]): FilterOption[] => {
    const counts = facetCounts(skills, terms, filters, facet);
    return all.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 }));
  };
  const optionLists = useMemo(() => {
    const uniq = (values: string[], label = (v: string) => v) => [...new Set(values)].sort().map((v) => ({ value: v, label: label(v) }));
    return {
      guilds: catalog.roles.map((r) => ({ value: r.id, label: r.name })),
      licenses: uniq(catalog.skills.map((s) => s.license), licenseName),
      authors: uniq(catalog.skills.map((s) => author(s))),
    } satisfies Record<SkillFacet, { value: string; label: string }[]>;
  }, [catalog]);
  const nameOf = (facet: SkillFacet, value: string) => optionLists[facet].find((o) => o.value === value)?.label ?? value;
  const facetActive = (Object.keys(filters) as SkillFacet[]).some((f) => filters[f].length > 0);
  const anyFilter = mine || facetActive;
  const narrowed = terms.length > 0 || anyFilter;

  useEffect(() => setLimit(PAGE), [tab, deferredQuery, filters, mine, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry!.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit, shownCount, tab]);

  const update = (change: (s: Selection) => Selection) => {
    setSelection(change);
    setDone(null);
  };
  const switchTab = (next: Tab) => {
    setTab(next);
    setSort("match");
    setFilters(NO_FILTERS);
  };
  const clearNarrowing = () => {
    setQuery("");
    setFilters(NO_FILTERS);
    setMine(false);
  };

  // Bulk actions for what the list shows.
  const shownIds = tab === "skills" ? skillResults.map((e) => e.skill.id) : guildResults.map((e) => e.role.id);
  const key = tab === "skills" ? "skills" : "roles";
  const pickedShown = shownIds.filter((id) => selection[key].includes(id)).length;
  const addShown = () => update((s) => ({ ...s, [key]: including(s[key], shownIds) }));
  const removeShown = () => update((s) => ({ ...s, [key]: without(s[key], shownIds) }));

  const hint =
    scrollCount === 0
      ? "Welcome, traveller! Search or browse, then tap a guild or a skill to put it in thy scroll."
      : done === "downloaded"
        ? "The scroll is thine! Now run the commands below, where you saved it."
        : done === "copied"
          ? asking
            ? "The prompt is copied. Hand it to thy agent."
            : "The commands are copied. Run them in a terminal, where you saved the file."
          : `Thy scroll holds ${plural(scrollCount, "skill")}. Download its file below, then run the commands under it.`;

  const sorts: [Sort, string][] =
    tab === "skills"
      ? [
          ["match", "Best match"],
          ["name", "Name"],
          ["newest", "Newest"],
        ]
      : [
          ["match", "Best match"],
          ["name", "Name"],
          ["size", "Most skills"],
        ];

  return (
    <div className="split shop" data-bar={scrollCount > 0 && !scrollInView}>
      <div className="shop-main">
        <div className="stack finder">
          <label className="search">
            <svg viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
              <path d="M1 0h3v1H1zM0 1h1v3H0zM4 1h1v3H4zM1 4h3v1H1zM4 5h1v1H4zM5 6h1v1H5zM6 7h1v1H6z" fill="currentColor" />
            </svg>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${plural(skills.length, "skill")} and ${plural(guilds.length, "guild")}…`}
              aria-label="Search the market"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button type="button" className="search-clear" aria-label="Clear the search" onClick={() => setQuery("")}>
                ×
              </button>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </label>

          <div className="tabs" role="tablist" aria-label="Browse">
            {(
              [
                ["guilds", "Guilds", guildResults.length],
                ["skills", "Skills", skillResults.length],
              ] as const
            ).map(([id, name, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls="shop-results"
                className="tab"
                onClick={() => tab !== id && switchTab(id)}
              >
                {name} <span className="count">{count}</span>
              </button>
            ))}
          </div>

          <div className="toolbar" role="group" aria-label="Filters">
            {tab === "skills" &&
              (Object.keys(facetLabels) as SkillFacet[]).map((facet) => (
                <FilterMenu
                  key={facet}
                  label={facetLabels[facet]}
                  options={facetOptions(facet, optionLists[facet])}
                  selected={filters[facet]}
                  onChange={(next) => setFilters((f) => ({ ...f, [facet]: next }))}
                />
              ))}
            <button type="button" className="btn btn-secondary btn-sm" aria-pressed={mine} onClick={() => setMine((m) => !m)}>
              In thy scroll
            </button>
            {catalog.held.length > 0 && (
              <label className="check check-danger gate-opt" title="Skills that did not clear the watch. They come straight from their own repositories.">
                <input type="checkbox" checked={selection.held} onChange={(e) => update((s) => ({ ...s, held: e.target.checked }))} />
                Include the {catalog.held.length} at the gate (not cleared)
              </label>
            )}
            <div className="toolbar-end">
              <ChoiceMenu label="Sort" value={sort} choices={sorts} onChange={setSort} />
            </div>
          </div>

          {anyFilter && (
            <div className="cluster" role="group" aria-label="Applied filters">
              {(Object.keys(filters) as SkillFacet[]).flatMap((facet) =>
                filters[facet].map((value) => (
                  <button
                    key={`${facet}:${value}`}
                    type="button"
                    className="chip"
                    aria-label={`Remove filter ${facetLabels[facet]}: ${nameOf(facet, value)}`}
                    onClick={() => setFilters((f) => ({ ...f, [facet]: f[facet].filter((v) => v !== value) }))}
                  >
                    <span className="chip-kind">{facetLabels[facet]}:</span> {nameOf(facet, value)} <span aria-hidden="true">×</span>
                  </button>
                )),
              )}
              {mine && (
                <button type="button" className="chip" aria-label="Remove filter: in thy scroll" onClick={() => setMine(false)}>
                  In thy scroll <span aria-hidden="true">×</span>
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setFilters(NO_FILTERS), setMine(false))}>
                Clear all
              </button>
            </div>
          )}

          <div className="results-head">
            <p className="fine" aria-live="polite">
              {narrowed ? `${shownCount} of ${plural(total, noun)}` : plural(total, noun)}
            </p>
            {narrowed && shownCount > 0 && (
              <div className="cluster">
                {pickedShown < shownCount && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addShown}>
                    Add all {shownCount}
                  </button>
                )}
                {pickedShown > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeShown}>
                    Remove {pickedShown}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <ul id="shop-results" role="tabpanel" aria-labelledby={`tab-${tab}`} className="rows">
          {tab === "guilds" &&
            guildResults.slice(0, limit).map(({ role }) => {
              const on = selection.roles.includes(role.id);
              const id = `guild-${role.id}`;
              return (
                <li key={role.id} className="row shop-row" data-on={on}>
                  <button
                    type="button"
                    className="row-toggle"
                    aria-pressed={on}
                    aria-labelledby={`${id}-name`}
                    aria-describedby={`${id}-text`}
                    onClick={() => update((s) => ({ ...s, roles: on ? without(s.roles, [role.id]) : including(s.roles, [role.id]) }))}
                  >
                    <span className="row-check" data-state={on ? "on" : "off"} aria-hidden="true" />
                    <img src={`/art/guilds/${role.id}.png`} alt="" width={48} height={56} loading="lazy" className="pixel row-art" />
                    <span className="row-main">
                      <span className="row-title">
                        <span id={`${id}-name`} className="row-name">
                          {highlight(role.name, terms)}
                        </span>
                        <span className="row-meta">
                          {plural(role.skills.length, "skill")}
                          {role.held.length > 0 && ` · ${role.held.length} at the gate`}
                        </span>
                      </span>
                      <span id={`${id}-text`} className="row-text">
                        {role.description}
                      </span>
                      <span className="row-meta row-brings">
                        Brings: {role.skills.slice(0, TAGS).join(", ")}
                        {role.skills.length > TAGS && ` +${role.skills.length - TAGS}`}
                      </span>
                    </span>
                  </button>
                  <a className="btn btn-ghost btn-sm row-link" href={`/roles/${role.id}`}>
                    Details<span className="sr-only"> of the {role.name} guild</span>
                  </a>
                </li>
              );
            })}
          {tab === "skills" &&
            skillResults.slice(0, limit).map(({ skill, held, guilds: of }) => {
              const own = selection.skills.includes(skill.id);
              const via = of.filter((g) => selection.roles.includes(g.id));
              const on = own || (via.length > 0 && (!held || selection.held));
              const id = `skill-${skill.id}`;
              return (
                <li key={skill.id} className="row shop-row" data-on={on}>
                  <button
                    type="button"
                    className="row-toggle"
                    aria-pressed={own}
                    aria-labelledby={held ? `${id}-name ${id}-held` : `${id}-name`}
                    aria-describedby={`${id}-text`}
                    onClick={() => update((s) => ({ ...s, skills: own ? without(s.skills, [skill.id]) : including(s.skills, [skill.id]) }))}
                  >
                    <span className="row-check" data-state={own ? "on" : on ? "via" : "off"} aria-hidden="true" />
                    <img src={`/art/skills/${skill.id}.png`} alt="" width={32} height={32} loading="lazy" className="pixel row-art row-icon" />
                    <span className="row-main">
                      <span className="row-title">
                        <span id={`${id}-name`} className="row-name">
                          {highlight(skill.id, terms)}
                        </span>
                        {held && (
                          <span id={`${id}-held`} className="badge badge-danger">
                            not cleared
                          </span>
                        )}
                        <span className="row-meta">
                          {skill.version} · {licenseName(skill.license)} · {author(skill)}
                        </span>
                      </span>
                      <span id={`${id}-text`} className="row-text">
                        {skill.description}
                      </span>
                      {on && !own && <span className="row-via">In thy scroll with {via.map((g) => `the ${g.name} guild`).join(" and ")}</span>}
                    </span>
                  </button>
                  <a className="btn btn-ghost btn-sm row-link" href={held ? `/ledger#held-${skill.id}` : `/skills/${skill.id}`}>
                    {held ? "Findings" : "Details"}
                    <span className="sr-only"> for {skill.id}</span>
                  </a>
                </li>
              );
            })}
          {shownCount === 0 && (
            <li className="empty">
              <p>Nothing in the market matches.</p>
              <div className="cluster">
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearNarrowing}>
                  Clear search and filters
                </button>
                <a className="btn btn-ghost btn-sm" href="/request">
                  Request a skill
                </a>
              </div>
            </li>
          )}
          {limit < shownCount && <li ref={sentinel} className="rows-more" aria-hidden="true" />}
        </ul>
      </div>

      <aside id="scroll" className="split-side shop-side" aria-labelledby="scroll-title">
        <div className="panel scroll-panel">
          <h2 id="scroll-title" className="name-tag">
            Thy scroll
          </h2>
          <div className="wizard">
            <img src="/art/portrait.png" alt="" width={72} height={72} className="pixel" />
            <p aria-live="polite">{hint}</p>
          </div>

          {scrollCount > 0 && (
            <>
              <div className="stack scroll-contents">
                {picked.guilds.length > 0 && (
                  <section className="stack stack-sm" aria-labelledby="scroll-guilds">
                    <h3 id="scroll-guilds" className="eyebrow">
                      Guilds <span className="count">{picked.guilds.length}</span>
                    </h3>
                    <ul className="scroll-list">
                      {picked.guilds.map((role) => (
                        <li key={role.id}>
                          <img src={`/art/guilds/${role.id}.png`} alt="" width={24} height={28} className="pixel" />
                          <span className="scroll-name">{role.name}</span>
                          <button
                            type="button"
                            className="unpick"
                            aria-label={`Take the ${role.name} guild out of thy scroll`}
                            onClick={() => update((s) => ({ ...s, roles: without(s.roles, [role.id]) }))}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {selected.length > 0 && (
                  <section className="stack stack-sm" aria-labelledby="scroll-skills">
                    <h3 id="scroll-skills" className="eyebrow">
                      Skills <span className="count">{selected.length}</span>
                    </h3>
                    <ul className="scroll-list">
                      {selected.map((skill) => {
                        const own = selection.skills.includes(skill.id);
                        return (
                          <li key={skill.id}>
                            <img src={`/art/skills/${skill.id}.png`} alt="" width={24} height={24} className="pixel" />
                            <span className="scroll-name">
                              {skill.id} <span className="scroll-meta">{skill.version}</span>
                            </span>
                            {own ? (
                              <button
                                type="button"
                                className="unpick"
                                aria-label={`Take ${skill.id} out of thy scroll`}
                                onClick={() => update((s) => ({ ...s, skills: without(s.skills, [skill.id]) }))}
                              >
                                ×
                              </button>
                            ) : (
                              <span className="badge" title="Comes with a guild in thy scroll">
                                guild
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {picked.held.length > 0 && (
                  <section className="stack stack-sm scroll-danger" aria-labelledby="scroll-held">
                    <h3 id="scroll-held" className="eyebrow">
                      At the gate <span className="count">{picked.held.length}</span>
                    </h3>
                    <ul className="scroll-list">
                      {picked.held.map((skill) => (
                        <li key={skill.id}>
                          <img src={`/art/skills/${skill.id}.png`} alt="" width={24} height={24} className="pixel" />
                          <span className="scroll-name">{skill.id}</span>
                          <span className="badge badge-danger">not cleared</span>
                          <a className="scroll-why" href={`/ledger#held-${skill.id}`}>
                            Why<span className="sr-only"> {skill.id} is not cleared</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <button type="button" className="btn btn-ghost btn-sm scroll-empty" onClick={() => update((s) => ({ ...s, roles: [], skills: [] }))}>
                  Empty the scroll
                </button>
              </div>

              <div className="stack scroll-install">
                <InstallPanel
                  catalog={catalog}
                  picked={picked}
                  ctx={ctx}
                  subject={
                    picked.guilds.length === 1 && !picked.skills.length
                      ? `the ${picked.guilds[0]!.name} guild`
                      : picked.skills.length === 1 && !picked.guilds.length
                        ? picked.skills[0]!.id
                        : `these ${plural(scrollCount, "skill")}`
                  }
                  page={
                    picked.guilds.length === 1 && !picked.skills.length
                      ? `/roles/${picked.guilds[0]!.id}`
                      : picked.skills.length === 1 && !picked.guilds.length
                        ? `/skills/${picked.skills[0]!.id}`
                        : "/catalog.json"
                  }
                  tab={asking ? "agent" : selection.harness}
                  onTab={(t: InstallTab) => {
                    setAsking(t === "agent");
                    if (t !== "agent") update((s) => ({ ...s, harness: t }));
                  }}
                  onDone={setDone}
                />
                <p className="fine">
                  Pinned to commit <code>{ctx.sha.slice(0, 7)}</code>.
                </p>
              </div>
            </>
          )}
        </div>
      </aside>

      {scrollCount > 0 && !scrollInView && (
        <div className="scroll-bar" role="region" aria-label="Thy scroll, in short">
          <span>{plural(scrollCount, "skill")} in thy scroll</span>
          <a href="#scroll" className="btn btn-primary btn-sm">
            View scroll
          </a>
        </div>
      )}
    </div>
  );
}

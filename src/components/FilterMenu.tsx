import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FilterOption = { value: string; label: string; count: number };

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * A filter button that opens a checklist: every option shows how many results it would give, options that would
 * give none are hidden unless picked, and long lists get their own search box.
 */
export default function FilterMenu({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [find, setFind] = useState("");
  const needle = find.trim().toLowerCase();
  const shown = options
    .filter((o) => o.count > 0 || selected.includes(o.value))
    .filter((o) => !needle || o.label.toLowerCase().includes(needle))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return (
    <Popover onOpenChange={(open) => !open && setFind("")}>
      <PopoverTrigger asChild>
        <button type="button" className="btn btn-secondary btn-sm menu-trigger" data-active={selected.length > 0}>
          {label}
          {selected.length > 0 && (
            <span className="count" aria-label={`${selected.length} picked`}>
              {selected.length}
            </span>
          )}
          <span className="chevron" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="panel stack stack-sm menu" aria-label={`Filter by ${label.toLowerCase()}`}>
        {options.length > 8 && (
          <input
            type="search"
            className="input"
            placeholder={`Find a ${label.toLowerCase()}…`}
            aria-label={`Find a ${label.toLowerCase()}`}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
        )}
        <ul className="menu-options">
          {shown.map((o) => (
            <li key={o.value}>
              <label className="check menu-option">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onChange(toggle(selected, o.value))} />
                <span className="menu-option-label">{o.label}</span>
                <span className="count">{o.count}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="fine">Nothing matches.</li>}
        </ul>
        {selected.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm menu-clear" onClick={() => onChange([])}>
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** A button that opens a short list of choices, one of them picked (the blue bar); picking one closes it. */
export function ChoiceMenu<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: [T, string][];
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = choices.find(([v]) => v === value)?.[1] ?? "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="btn btn-secondary btn-sm menu-trigger" aria-label={`${label}: ${current}`}>
          <span className="menu-kind">{label}:</span> {current}
          <span className="chevron" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="panel menu menu-narrow" aria-label={label}>
        <div className="segments menu-choices" role="group" aria-label={label}>
          {choices.map(([v, name]) => (
            <button
              key={v}
              type="button"
              className="segment"
              aria-pressed={v === value}
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

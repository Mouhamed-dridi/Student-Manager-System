import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listPlacement } from "@/lib/listPlacement";
import { cn } from "@/lib/utils";

export interface PersonOption {
  id: string;
  label: string;
}

interface PeopleMultiSelectProps {
  label: string;
  options: PersonOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Shown when the roster came back empty (e.g. no teachers exist). */
  noOptionsText?: string;
}

/**
 * A searchable multi-select for people (teachers / students).
 *
 * Hand-rolled rather than built on a select primitive because it needs to be
 * searchable *and* multi-select with removable chips, and the Base UI combobox
 * derives its filter label internally, which cannot be verified without a
 * browser. Everything here is plain React, so the behaviour is explicit:
 *
 * - typing filters the list by substring, case-insensitively
 * - Enter adds the first exact-name match
 * - Backspace on an empty query removes the last chip
 * - clicking outside closes the list
 *
 * The option list is rendered through a portal on document.body. It cannot be
 * an absolutely positioned child of the form: the Card component sets
 * `overflow-hidden` (see components/ui/card.tsx), which clips such a list to
 * the card's rounded box. Portalling also lets the list flip above the input
 * when there is not enough room below, so a long form never cuts it off.
 */
export default function PeopleMultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches.",
  noOptionsText = "Nobody available.",
}: PeopleMultiSelectProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listStyle, setListStyle] = useState<CSSProperties | null>(null);

  const labelOf = useMemo(
    () => new Map(options.map((option) => [option.id, option.label])),
    [options],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  };

  const addFromQuery = () => {
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const exact = filtered.find(
      (option) => option.label.toLowerCase() === needle,
    );
    if (exact && !selected.includes(exact.id)) {
      onChange([...selected, exact.id]);
    }
    setQuery("");
  };

  /** Pins the portalled list to the input, flipping above when it must. */
  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setListStyle(
      listPlacement(rect, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, []);

  /**
   * Opens the list and places it in the same event that caused the open, so the
   * position is computed before paint rather than from an effect (which would
   * cost an extra render and flash at the old position).
   */
  const openList = useCallback(() => {
    setOpen(true);
    place();
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => place();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", onReposition);
    // capture: the list is portalled, so a scroll on any ancestor moves it.
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, place]);

  const list = open && listStyle && typeof document !== "undefined" ? (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      style={listStyle}
      className="z-50 max-h-56 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
    >
      <div className="flex gap-1 border-b px-1 pb-1">
        <button
          type="button"
          onClick={() => onChange(filtered.map((option) => option.id))}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        filtered.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => toggle(option.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      <Label text={label} count={selected.length} />

      {/* Chips for everything already chosen. Ids that no longer resolve to a
          person (a trashed teacher, a stale id) are shown as "Unknown" rather
          than silently dropped, so the stored value is never a mystery. */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs font-medium"
            >
              {labelOf.get(id) ?? "Unknown"}
              <button
                type="button"
                aria-label={`Remove ${labelOf.get(id) ?? "entry"}`}
                onClick={() => toggle(id)}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1">
        <Input
          ref={anchorRef}
          value={query}
          placeholder={options.length === 0 ? noOptionsText : placeholder}
          disabled={options.length === 0}
          onChange={(event) => {
            setQuery(event.target.value);
            openList();
          }}
          onFocus={openList}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFromQuery();
            } else if (event.key === "Escape") {
              setOpen(false);
            } else if (
              event.key === "Backspace" &&
              query === "" &&
              selected.length > 0
            ) {
              onChange(selected.slice(0, -1));
            }
          }}
          aria-expanded={open}
          aria-controls={listId}
          role="combobox"
          aria-autocomplete="list"
        />
        <button
          type="button"
          aria-label="Toggle list"
          onClick={() => (open ? setOpen(false) : openList())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {/* The list is NOT nested inside the anchor wrapper on purpose: it is
          portalled to the body so no ancestor's overflow can clip it. */}
      {list && createPortal(list, document.body)}
    </div>
  );
}

/** Small local label so the component does not depend on the page's Label. */
function Label({ text, count }: { text: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{text}</span>
      <span className="text-xs text-muted-foreground">{count} selected</span>
    </div>
  );
}

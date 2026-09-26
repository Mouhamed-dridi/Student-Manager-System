// Tag input for a list of short labels (the course's "skills"). Typing a value
// and pressing Enter or a comma turns it into a removable pill; the underlying
// state is a plain string[] so it maps straight onto the courses.skills text[]
// column. Pasting a comma-separated list expands into one tag per item.

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Trims, drops blanks and removes case-insensitive duplicates, keeping order. */
function normalize(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export default function SkillsInput({
  value,
  onChange,
  id,
  placeholder = "Add a skill and press Enter",
  disabled,
  className,
}: SkillsInputProps) {
  // The in-progress token. Kept separate from `value` so a half-typed word is
  // never mistaken for a committed tag.
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string[]) => {
    const next = normalize([...value, ...raw]);
    if (next.length === value.length) {
      // Nothing new (blank or duplicate) — just drop the draft.
      setDraft("");
      return;
    }
    onChange(next);
    setDraft("");
  };

  const remove = (skill: string) => {
    onChange(value.filter((s) => s !== skill));
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        disabled && "pointer-events-none bg-input/50 opacity-50",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs font-medium"
        >
          {skill}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${skill}`}
            onClick={(e) => {
              // Keep focus in the input so a teacher can keep typing after a
              // removal without clicking back into the field.
              e.stopPropagation();
              remove(skill);
              inputRef.current?.focus();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Never commit mid-IME-composition: Enter is confirming the
          // candidate window, not finishing a tag.
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit([draft]);
            return;
          }
          // Backspace on an empty field removes the previous tag, the standard
          // tag-input shortcut.
          if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => commit([draft])}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (!text.includes(",")) return;
          // Let a comma-separated paste become one tag per item.
          e.preventDefault();
          commit(text.split(","));
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        aria-label="Add a skill"
        className="min-w-32 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}

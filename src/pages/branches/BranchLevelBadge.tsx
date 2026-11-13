import { cn } from "@/lib/utils";
import type { BranchLevel } from "@/lib/api";

// The track badge (CAP / BTP / BTS) shared by the Branches grid and the class
// detail page. Deliberately monochrome so the badge reads as a stamp, not as
// another status colour: the level is the only thing it encodes.
const TONE: Record<BranchLevel, string> = {
  CAP: "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white",
  BTP: "border-zinc-400 bg-zinc-300 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50",
  BTS: "border-zinc-700 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-white",
};

export default function BranchLevelBadge({
  level,
  className,
}: {
  level: BranchLevel | "";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm border px-1.5 text-[10px] font-semibold tracking-widest uppercase",
        level ? TONE[level] : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {level || "Branch"}
    </span>
  );
}

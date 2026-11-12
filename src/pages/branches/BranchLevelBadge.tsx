import { cn } from "@/lib/utils";
import type { BranchLevel } from "@/lib/api";

// The track badge (CAP / BTP / BTS) shared by the Branches grid and the class
// detail page. Deliberately monochrome so the badge reads as a stamp, not as
// another status colour: the level is the only thing it encodes.
const TONE: Record<BranchLevel, string> = {
  CAP: "bg-zinc-900 text-white border-zinc-700",
  BTP: "bg-zinc-800 text-zinc-50 border-zinc-600",
  BTS: "bg-zinc-700 text-white border-zinc-500",
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

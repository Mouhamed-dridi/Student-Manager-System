import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string;
  fallback?: string;
  className?: string;
}

function initials(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export default function UserAvatar({
  name,
  fallback = "U",
  className,
}: UserAvatarProps) {
  const text = initials(name) || fallback.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {text}
    </div>
  );
}
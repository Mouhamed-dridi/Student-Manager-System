import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string;
  /** Photo URL (remote or a stored data URL). Falls back to initials. */
  src?: string;
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
  src,
  fallback = "U",
  className,
}: UserAvatarProps) {
  // A broken remote URL should degrade to initials, not show a broken-image
  // icon. Tracking the failed URL (instead of a boolean) means a newly picked
  // photo is tried again without remounting the component.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const text = initials(name) || fallback.charAt(0).toUpperCase();

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : "User avatar"}
        onError={() => setFailedSrc(src)}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full border bg-muted object-cover",
          className,
        )}
      />
    );
  }

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

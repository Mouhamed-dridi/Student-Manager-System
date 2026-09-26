// Star rating in two modes:
// - "display": a read-only row, optionally filled to a fraction of the row
//   (used for a course average like 4.3/5).
// - "input": five radio buttons behind star labels, so the keyboard and screen
//   readers get real radio semantics without any custom key handling.
//
// Built on lucide's Star icon — no extra dependency.

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STAR_CLASS = "h-4 w-4";

interface StarRatingProps {
  /** Filled stars out of 5. Fractional values fill the row proportionally. */
  value: number;
  max?: number;
  className?: string;
  /** Star size in Tailwind classes. */
  sizeClass?: string;
}

/** Read-only stars, filled to `value / max` of the row width. */
export function StarRatingDisplay({
  value,
  max = 5,
  className,
  sizeClass,
}: StarRatingProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const stars = Array.from({ length: max }, (_, i) => i);
  const row = "flex items-center gap-0.5";

  return (
    <div
      className={cn("relative inline-flex", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of ${max} stars`}
    >
      <div className={row} aria-hidden="true">
        {stars.map((i) => (
          <Star
            key={i}
            className={cn(STAR_CLASS, sizeClass, "text-muted-foreground/40")}
          />
        ))}
      </div>
      {/* Second row clipped to the fill percentage, stacked over the outline. */}
      {percent > 0 ? (
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          <div className={row}>
            {stars.map((i) => (
              <Star
                key={i}
                className={cn(STAR_CLASS, sizeClass, "shrink-0 fill-amber-400 text-amber-400")}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  className?: string;
  disabled?: boolean;
}

/** Interactive 1..max star picker backed by real radio inputs. */
export function StarRatingInput({
  value,
  onChange,
  max = 5,
  className,
  disabled,
}: StarRatingInputProps) {
  const groupId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={() => setHover(null)}
    >
      {stars.map((n) => (
        <label
          key={n}
          className={cn(
            "cursor-pointer p-0.5",
            disabled && "cursor-not-allowed opacity-60",
          )}
          onMouseEnter={() => !disabled && setHover(n)}
        >
          <input
            type="radio"
            name={`${groupId}-rating`}
            value={n}
            checked={value === n}
            disabled={disabled}
            onChange={() => onChange(n)}
            className="sr-only"
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          />
          <Star
            aria-hidden="true"
            className={cn(
              "h-7 w-7 transition-colors",
              n <= shown
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40",
            )}
          />
        </label>
      ))}
    </div>
  );
}

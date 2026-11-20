import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group relative inline-flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-input bg-transparent shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-checked:bg-primary dark:data-[indeterminate]:bg-primary dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {/* A partially selected parent list shows a dash instead of a tick. */}
        <Check className="size-3.5 group-data-[indeterminate]:hidden" />
        <Minus className="hidden size-3.5 group-data-[indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

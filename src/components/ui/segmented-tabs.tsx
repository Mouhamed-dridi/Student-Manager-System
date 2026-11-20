// Segmented "list / add" toggle used by the toolbar on Students, Teachers,
// Accounts and My Courses. It renders the same Base UI Tabs primitives as the
// default `TabsList`/`TabsTrigger` (so panels, `aria-controls` and arrow-key
// navigation keep working) but skins them as two independent pill buttons:
// solid zinc for the selected segment, muted zinc for the other one.
//
// Height is deliberately h-8 to match the neighbouring `Button` (default size),
// which is what keeps the toolbar row - toggle, Import Excel, Export Excel -
// on one optical line.

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

function SegmentedTabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="segmented-tabs-list"
      className={cn("inline-flex h-8 w-fit items-center gap-1", className)}
      {...props}
    />
  )
}

function SegmentedTabsTrigger({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="segmented-tabs-trigger"
      className={cn(
        "inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
        "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900",
        "data-active:bg-zinc-900 data-active:text-white data-active:shadow-sm",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50",
        // Inverted in dark mode so the selected segment still reads as "solid".
        "dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
        "dark:data-active:bg-white dark:data-active:text-zinc-950",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { SegmentedTabsList, SegmentedTabsTrigger }

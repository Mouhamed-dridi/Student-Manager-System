import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemName: string;
  universityName?: string;
  /** The portal's nav links; the drawer only provides the shell. */
  children: React.ReactNode;
}

/**
 * The mobile counterpart of a portal's fixed sidebar: a left Sheet that holds
 * the same navigation. It is only reachable through the header's hamburger
 * button (`lg:hidden`), so desktop never renders it.
 */
export default function MobileNavDrawer({
  open,
  onOpenChange,
  systemName,
  universityName,
  children,
}: MobileNavDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
      >
        <SheetHeader className="min-h-14 justify-center py-2">
          <SheetTitle className="truncate text-lg font-semibold leading-tight">
            {systemName}
          </SheetTitle>
          {universityName ? (
            <SheetDescription className="truncate text-xs">
              {universityName}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              Main navigation
            </SheetDescription>
          )}
        </SheetHeader>
        <Separator />
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">{children}</nav>
      </SheetContent>
    </Sheet>
  );
}

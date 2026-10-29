// Generic "Customize Dashboard Widgets" dialog shared by the operator, teacher
// and student dashboards. It renders whatever catalog the page hands it, so
// each portal only declares its own widget ids/labels.
//
// The draft lives in a child that remounts on every open: no effect syncing
// props into state, and Cancel/X/Escape/overlay close can never leak a
// discarded edit into the next visit. Save hands the draft to the page, which
// owns persistence.

import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DashboardWidget,
  DashboardWidgetPrefs,
} from "@/lib/dashboardWidgets";

interface CustomizeWidgetsDialogProps<Id extends string> {
  open: boolean;
  widgets: readonly DashboardWidget<Id>[];
  preferences: DashboardWidgetPrefs<Id>;
  onOpenChange: (open: boolean) => void;
  onSave: (preferences: DashboardWidgetPrefs<Id>) => void;
}

export default function CustomizeWidgetsDialog<Id extends string>({
  open,
  widgets,
  preferences,
  onOpenChange,
  onSave,
}: CustomizeWidgetsDialogProps<Id>) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <WidgetChecklist
          // A fresh draft each time the dialog opens.
          key={open ? "open" : "closed"}
          widgets={widgets}
          preferences={preferences}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function WidgetChecklist<Id extends string>({
  widgets,
  preferences,
  onSave,
  onCancel,
}: {
  widgets: readonly DashboardWidget<Id>[];
  preferences: DashboardWidgetPrefs<Id>;
  onSave: (preferences: DashboardWidgetPrefs<Id>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DashboardWidgetPrefs<Id>>(preferences);

  const toggle = (id: Id) => {
    setDraft((current) => ({ ...current, [id]: !current[id] }));
  };

  const hiddenCount = widgets.filter((widget) => !draft[widget.id]).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Customize Dashboard Widgets
        </DialogTitle>
        <DialogDescription>
          Choose which cards and charts appear on your dashboard. This
          preference is saved in this browser.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        {widgets.map((widget) => {
          const labelId = `widget-${widget.id}-label`;
          const descriptionId = `widget-${widget.id}-description`;
          return (
            // The whole row toggles (mouse convenience); the checkbox itself
            // stays the real control, so keyboard and screen readers are
            // unaffected.
            <div
              key={widget.id}
              onClick={() => toggle(widget.id)}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                id={`widget-${widget.id}`}
                checked={draft[widget.id]}
                onCheckedChange={() => toggle(widget.id)}
                onClick={(event) => event.stopPropagation()}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p id={labelId} className="text-sm font-medium">
                  {widget.label}
                </p>
                <p
                  id={descriptionId}
                  className="mt-0.5 text-xs text-muted-foreground"
                >
                  {widget.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {hiddenCount === 0
            ? "All widgets shown"
            : `${hiddenCount} widget${hiddenCount === 1 ? "" : "s"} hidden`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onCancel();
            }}
          >
            Save Preferences
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

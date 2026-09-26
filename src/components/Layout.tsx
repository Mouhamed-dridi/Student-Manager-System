import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  isSectionActive,
  isSectionExpanded,
  menuItems,
  toggleSectionOpen,
  type MenuKey,
} from "@/components/sectionMenu";
import { cn } from "@/lib/utils";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import StudentsPage from "@/pages/students/StudentsPage";
import TeachersPage from "@/pages/teachers/TeachersPage";
import PayPage from "@/pages/pay/PayPage";
import PaymentHistoryPage from "@/pages/pay/PaymentHistoryPage";
import PaymentTrashPage from "@/pages/pay/PaymentTrashPage";
import AbsencePage from "@/pages/absence/AbsencePage";
import PublicationsPage from "@/pages/publications/PublicationsPage";
import EventsPage from "@/pages/events/EventsPage";
import EventHistoryPage from "@/pages/events/EventHistoryPage";
import type { AppEvent } from "@/lib/api";
import UserManagementPage from "@/pages/users/UserManagementPage";
import GeneralTrashPage from "@/pages/trash/GeneralTrashPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import UserAvatar from "@/components/UserAvatar";
import { clearSession } from "@/lib/session";
import { useAuthDisplayName } from "@/lib/authDisplay";
import { brandTitle, useBranding } from "@/lib/branding";

export default function Layout() {
  const [active, setActive] = useState<MenuKey>("dashboard");
  // Which collapsible sidebar sections are open, keyed by parent menu key.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    pay: true,
  });
  // The event the "New Event" form is editing, or null to create a new one.
  // Lifted here because the sidebar swaps between the form and the history
  // page without a router change: Edit sets this, then jumps to the form.
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const navigate = useNavigate();
  const branding = useBranding();
  const displayName = useAuthDisplayName("Admin");

  const handleSectionClick = (item: (typeof menuItems)[number]) => {
    const sectionActive = isSectionActive(item, active);
    setOpenSections((prev) => toggleSectionOpen(prev, item.key, sectionActive));
    if (!sectionActive) {
      setActive(item.key);
      // Entering Events from elsewhere always starts a new event, not an edit.
      if (item.key === "events") setEditingEvent(null);
    }
  };

  const pages: Record<MenuKey, React.ReactNode> = {
    dashboard: <DashboardPage />,
    students: <StudentsPage />,
    teachers: <TeachersPage />,
    pay: <PayPage />,
    "pay-history": <PaymentHistoryPage />,
    "pay-trash": <PaymentTrashPage />,
    absence: <AbsencePage />,
    publications: <PublicationsPage />,
    events: (
      <EventsPage
        initialEvent={editingEvent}
        onSaved={() => setEditingEvent(null)}
      />
    ),
    "event-history": (
      <EventHistoryPage
        onEdit={(event) => {
          setEditingEvent(event);
          setActive("events");
        }}
      />
    ),
    users: <UserManagementPage />,
    trash: <GeneralTrashPage />,
    settings: <SettingsPage />,
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex min-h-14 flex-col justify-center px-4">
          <span className="truncate text-lg font-semibold leading-tight">
            {branding.systemName}
          </span>
          {branding.universityName && (
            <span className="truncate text-xs text-muted-foreground">
              {branding.universityName}
            </span>
          )}
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {menuItems.map((item) => {
            if (item.children) {
              const sectionActive = isSectionActive(item, active);
              const expanded = isSectionExpanded(openSections, item, active);
              return (
                <div key={item.key}>
                  <button
                    onClick={() => handleSectionClick(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      sectionActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded && (
                    <div className="mt-1 space-y-1">
                      {item.children.map((child) => (
                        <button
                          key={child.key}
                          onClick={() => setActive(child.key)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md py-1.5 pr-3 pl-10 text-sm font-medium transition-colors",
                            active === child.key
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active === item.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <span className="text-sm font-medium text-muted-foreground">
            {brandTitle(branding)}
          </span>
          <div className="flex items-center gap-3">
            <UserAvatar name={displayName} fallback="A" />
            <span className="max-w-40 truncate text-sm font-medium text-muted-foreground">
              {displayName}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{pages[active]}</main>
      </div>
    </div>
  );
}
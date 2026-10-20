import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LayoutDashboard,
  Megaphone,
  BookOpenCheck,
  ClipboardList,
  Users,
  CalendarDays,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import TeacherDashboardPage from "./TeacherDashboardPage";
import TeacherAnnouncementsPage from "./TeacherAnnouncementsPage";
import MyCoursesPage from "./MyCoursesPage";
import CreateExamView from "./CreateExamView";
import ExamsTableView from "./ExamsTableView";
import ExamScoreView from "./ExamScoreView";
import MyClassPage from "./MyClassPage";
import PlanningPage from "./PlanningPage";
import TeacherEventsPage from "./TeacherEventsPage";
import TeacherEventDetailPage from "./TeacherEventDetailPage";
import QcmPage from "./QcmPage";
import UserAvatar from "@/components/UserAvatar";
import { useBranding } from "@/lib/branding";
import { loadCurrentTeacher } from "./currentTeacher";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import { clearSession } from "@/lib/session";
import { useUnreadAnnouncements } from "@/hooks/useUnreadAnnouncements";

type PageKey =
  | "dashboard"
  | "announcements"
  | "courses"
  | "exam-create"
  | "exams-table"
  | "exam-score"
  | "class"
  | "planning"
  | "events"
  | "qcm";

type TeacherMenuItem =
  | { key: PageKey; label: string; icon: LucideIcon; children?: undefined }
  | {
      key: "exams";
      label: string;
      icon: LucideIcon;
      children: { key: PageKey; label: string }[];
    };

const menuItems: TeacherMenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "courses", label: "Courses", icon: BookOpenCheck },
  // Course exams (create form, saved table, grade matrix) and interactive
  // quizzes (QCM) grouped under one collapsible parent. Sections are state, not
  // routes, so the parent only opens the submenu — selecting a child sets the
  // active page and the parent stays expanded while a child is active.
  {
    key: "exams",
    label: "Exams",
    icon: ClipboardList,
    children: [
      { key: "exam-create", label: "Create Exam" },
      { key: "exams-table", label: "Exams Table" },
      { key: "exam-score", label: "Exam Score" },
      { key: "qcm", label: "QCM" },
    ],
  },
  { key: "class", label: "Class", icon: Users },
  { key: "planning", label: "Planning", icon: CalendarDays },
  // Read-only view of the operator's events; CalendarClock keeps it distinct
  // from Planning's CalendarDays.
  { key: "events", label: "Events", icon: CalendarClock },
];

function clearTeacherSession() {
  clearSession();
}

export default function TeacherLayout() {
  const [active, setActive] = useState<PageKey>("dashboard");
  // Which collapsible sidebar sections are open. A parent with no entry yet
  // defaults to open when one of its children is active (see isSectionExpanded).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // An open event takes over the content area; the sidebar item stays
  // highlighted. Sections are not routes in this portal, so the detail view is
  // a swap rather than a navigation — hence its own state beside `active`.
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  // undefined = still fetching the record; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const navigate = useNavigate();
  const branding = useBranding();
  const unreadAnnouncements = useUnreadAnnouncements("teachers");

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher().then((t) => {
      if (!cancelled) setTeacher(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Record may have been deleted after login — end the session.
    if (teacher === null) {
      clearTeacherSession();
      navigate("/login");
    }
  }, [teacher, navigate]);

  const handleLogout = () => {
    clearTeacherSession();
    navigate("/login");
  };

  const isSectionActive = (item: TeacherMenuItem) =>
    item.children?.some((child) => child.key === active) ?? false;

  // Explicit toggle state wins; otherwise a parent is expanded exactly when one
  // of its children is the active page. This keeps "Exams" open on arriving at
  // Exams & Notes or QCM, while still letting the parent button collapse it.
  const isSectionExpanded = (item: TeacherMenuItem) =>
    openSections[item.key] ?? isSectionActive(item);

  const handleSectionToggle = (item: TeacherMenuItem) => {
    setOpenSections((prev) => ({
      ...prev,
      [item.key]: !(prev[item.key] ?? isSectionActive(item)),
    }));
    // Consistent with every other sidebar click: leaving Events closes it.
    setOpenEventId(null);
  };

  // Built here rather than at module level because the Events entry closes over
  // setOpenEventId. React keys reconciliation on element type, not identity, so
  // rebuilding the record on each render costs nothing.
  const pages: Record<PageKey, React.ReactNode> = {
    dashboard: <TeacherDashboardPage />,
    announcements: <TeacherAnnouncementsPage />,
    courses: <MyCoursesPage />,
    "exam-create": <CreateExamView />,
    "exams-table": <ExamsTableView />,
    "exam-score": <ExamScoreView />,
    class: <MyClassPage />,
    planning: <PlanningPage />,
    events: <TeacherEventsPage onOpenEvent={setOpenEventId} />,
    qcm: <QcmPage />,
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
            const Icon = item.icon;
            if (item.children) {
              const expanded = isSectionExpanded(item);
              return (
                <div key={item.key}>
                  <button
                    onClick={() => handleSectionToggle(item)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isSectionActive(item)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ChevronDown
                      className={`ml-auto h-4 w-4 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {expanded && (
                    <div className="mt-1 space-y-1">
                      {item.children.map((child) => (
                        <button
                          key={child.key}
                          onClick={() => {
                            setActive(child.key);
                            // Leaving the events section closes any open event.
                            setOpenEventId(null);
                          }}
                          className={`flex w-full items-center gap-3 rounded-md py-1.5 pr-3 pl-10 text-sm font-medium transition-colors ${
                            active === child.key
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActive(item.key);
                  // Leaving the events section also closes any open event.
                  setOpenEventId(null);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.key === "announcements" && unreadAnnouncements > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {unreadAnnouncements}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-muted-foreground">
            {teacher ? (
              <>
                {teacher.fullName}
                <span className="text-xs font-normal">
                  · {teacher.specialty || "Teacher"}
                </span>
              </>
            ) : (
              "Teacher Portal"
            )}
          </span>
          <div className="flex items-center gap-3">
            <UserAvatar name={teacher?.fullName} fallback="T" />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {openEventId ? (
            <TeacherEventDetailPage
              eventId={openEventId}
              onBack={() => setOpenEventId(null)}
            />
          ) : (
            pages[active]
          )}
        </main>
      </div>
    </div>
  );
}

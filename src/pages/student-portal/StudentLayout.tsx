import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  DollarSign,
  CalendarX,
  ChevronDown,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MobileNavDrawer from "@/components/MobileNavDrawer";
import StudentDashboardPage from "./StudentDashboardPage";
import CoursesPage from "./CoursesPage";
import MyPaymentsPage from "./MyPaymentsPage";
import MyAttendancePage from "./MyAttendancePage";
import AnnouncementsPage from "./AnnouncementsPage";
import StudentSettings from "./StudentSettings";
import StudentPlanningPage from "./StudentPlanningPage";
import StudentExamsPage from "./StudentExamsPage";
import StudentExamScoresPage from "./StudentExamScoresPage";
import UserAvatar from "@/components/UserAvatar";
import HeaderBackButton from "@/components/HeaderBackButton";
import ViewHistoryProvider from "@/hooks/ViewHistoryProvider";
import { useViewHistory } from "@/hooks/viewHistory";
import { useBranding } from "@/lib/branding";
import { subscribeStudentProfileChanged } from "@/lib/studentProfile";
import {
  loadUserProfile,
  useUserProfile,
  userProfileFullName,
} from "@/lib/userProfile";
import { loadCurrentStudent } from "./currentStudent";
import type { Student } from "@/pages/students/StudentForm";
import { clearSession } from "@/lib/session";
import { useUnreadAnnouncements } from "@/hooks/useUnreadAnnouncements";

type PageKey =
  | "dashboard"
  | "courses"
  | "planning"
  | "exams-list"
  | "exam-scores"
  | "payments"
  | "announcements"
  | "absence"
  | "settings";

type StudentMenuItem =
  | { key: PageKey; label: string; icon: LucideIcon; children?: undefined }
  | {
      key: "exams";
      label: string;
      icon: LucideIcon;
      children: { key: PageKey; label: string }[];
    };

const menuItems: StudentMenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "planning", label: "Planning", icon: CalendarDays },
  // Read-only exam sections grouped under one collapsible parent, mirroring the
  // teacher portal. Sections are state, not routes, so the parent only opens
  // the submenu; it stays expanded while one of its children is active.
  {
    key: "exams",
    label: "Exams",
    icon: ClipboardList,
    children: [
      { key: "exams-list", label: "Exams" },
      { key: "exam-scores", label: "Exam Score" },
    ],
  },
  { key: "payments", label: "My Payment", icon: DollarSign },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "absence", label: "Absence", icon: CalendarX },
  { key: "settings", label: "Settings", icon: Settings },
];

const pages: Record<PageKey, React.ReactNode> = {
  dashboard: <StudentDashboardPage />,
  courses: <CoursesPage />,
  planning: <StudentPlanningPage />,
  "exams-list": <StudentExamsPage />,
  "exam-scores": <StudentExamScoresPage />,
  payments: <MyPaymentsPage />,
  announcements: <AnnouncementsPage />,
  absence: <MyAttendancePage />,
  settings: <StudentSettings />,
};

function clearStudentSession() {
  clearSession();
}

export default function StudentLayout() {
  return (
    <ViewHistoryProvider root={{ key: "dashboard", label: "Dashboard" }}>
      <StudentShell />
    </ViewHistoryProvider>
  );
}

function StudentShell() {
  // Sections come from the shared history stack (see useViewHistory) so the
  // header back arrow and the sidebar agree on where the student is.
  const { currentSection, pushSection } = useViewHistory();
  const active = currentSection.key as PageKey;
  // Which collapsible sidebar sections are open. A parent with no entry yet
  // defaults to open when one of its children is active (see isSectionExpanded).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // The mobile navigation drawer; selecting a section closes it.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // undefined = still fetching the record; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const navigate = useNavigate();
  const branding = useBranding();
  const unreadAnnouncements = useUnreadAnnouncements("students");
  // user_profiles wins over the students row (see TeacherLayout).
  const profile = useUserProfile("student", student?.id);
  const displayName = userProfileFullName(profile) || student?.fullName;
  const avatar = profile?.avatarUrl;

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent().then((s) => {
      if (!cancelled) setStudent(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Warm the profile cache on every portal load (a no-op once it is cached).
  useEffect(() => {
    if (!student?.id) return;
    void loadUserProfile("student", student.id).catch(() => null);
  }, [student?.id]);

  // Saving the Profile tab asks the shell to re-read the record, so a new name
  // reaches the top bar without a page reload.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeStudentProfileChanged(() => {
      loadCurrentStudent().then((next) => {
        if (!cancelled) setStudent(next);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Record may have been deleted after login — end the session.
    if (student === null) {
      clearStudentSession();
      navigate("/login");
    }
  }, [student, navigate]);

  const handleLogout = () => {
    clearStudentSession();
    navigate("/login");
  };

  const isSectionActive = (item: StudentMenuItem) =>
    item.children?.some((child) => child.key === active) ?? false;

  // Explicit toggle state wins; otherwise a parent is expanded exactly when one
  // of its children is the active page.
  const isSectionExpanded = (item: StudentMenuItem) =>
    openSections[item.key] ?? isSectionActive(item);

  const handleSectionToggle = (item: StudentMenuItem) => {
    setOpenSections((prev) => ({
      ...prev,
      [item.key]: !(prev[item.key] ?? isSectionActive(item)),
    }));
  };

  // The header shows the active section's own label, including children whose
  // label differs from their parent ("Exam Score" inside "Exams").
  const activeLabel =
    menuItems
      .flatMap((item) =>
        item.children ? [item, ...item.children] : [item],
      )
      .find((item) => item.key === active)?.label ?? "Student Portal";

  // Rendered twice (desktop sidebar and mobile Sheet). `onNavigate` closes the
  // drawer once a section has actually been selected; toggling an open parent
  // keeps it open so its children stay reachable.
  const renderNav = (onNavigate?: () => void) => (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon;
        if (item.children) {
          const expanded = isSectionExpanded(item);
          return (
            <div key={item.key}>
              <button
                onClick={() => handleSectionToggle(item)}
                aria-expanded={expanded}
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
                        pushSection(child.key, child.label);
                        onNavigate?.();
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
              pushSection(item.key, item.label);
              onNavigate?.();
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
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — desktop only */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
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
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {renderNav()}
        </nav>
      </aside>

      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        systemName={branding.systemName}
        universityName={branding.universityName}
      >
        {renderNav(() => setMobileNavOpen(false))}
      </MobileNavDrawer>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <HeaderBackButton />
            <span className="truncate text-sm font-medium text-muted-foreground">
              {activeLabel}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <UserAvatar
              name={displayName}
              src={avatar ?? undefined}
              fallback="S"
            />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">
                {displayName || "Student"}
              </p>
              <p className="text-xs leading-tight text-muted-foreground">
                {student
                  ? student.program +
                    (student.training ? ` — ${student.training}` : "")
                  : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="w-full flex-1 overflow-auto p-4 sm:p-6">
          {pages[active]}
        </main>
      </div>
    </div>
  );
}

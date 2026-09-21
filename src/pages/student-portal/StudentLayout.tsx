import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  DollarSign,
  CalendarX,
  LayoutDashboard,
  Megaphone,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StudentDashboardPage from "./StudentDashboardPage";
import CoursesPage from "./CoursesPage";
import MyPaymentsPage from "./MyPaymentsPage";
import MyAttendancePage from "./MyAttendancePage";
import AnnouncementsPage from "./AnnouncementsPage";
import StudentSettingsPage from "./StudentSettingsPage";
import UserAvatar from "@/components/UserAvatar";
import { useBranding } from "@/lib/branding";
import { loadCurrentStudent } from "./currentStudent";
import type { Student } from "@/pages/students/StudentForm";
import { clearSession } from "@/lib/session";

const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "payments", label: "My Payment", icon: DollarSign },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "absence", label: "Absence", icon: CalendarX },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

const pages: Record<MenuKey, React.ReactNode> = {
  dashboard: <StudentDashboardPage />,
  courses: <CoursesPage />,
  payments: <MyPaymentsPage />,
  announcements: <AnnouncementsPage />,
  absence: <MyAttendancePage />,
  settings: <StudentSettingsPage />,
};

function clearStudentSession() {
  clearSession();
}

export default function StudentLayout() {
  const [active, setActive] = useState<MenuKey>("dashboard");
  // undefined = still fetching the record; null = record is gone.
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const navigate = useNavigate();
  const branding = useBranding();

  useEffect(() => {
    let cancelled = false;
    loadCurrentStudent().then((s) => {
      if (!cancelled) setStudent(s);
    });
    return () => {
      cancelled = true;
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
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
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
            {menuItems.find((item) => item.key === active)?.label ??
              "Student Portal"}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={student?.fullName} fallback="S" />
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">
                  {student?.fullName ?? "Student"}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {student
                    ? student.program +
                      (student.training ? ` — ${student.training}` : "")
                    : ""}
                </p>
              </div>
            </div>
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

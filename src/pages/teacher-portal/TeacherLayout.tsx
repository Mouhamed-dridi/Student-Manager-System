import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck, ClipboardList, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MyCoursesPage from "./MyCoursesPage";
import ExamsNotesPage from "./ExamsNotesPage";
import MyClassPage from "./MyClassPage";
import PlanningPage from "./PlanningPage";
import { loadCurrentTeacher } from "./currentTeacher";
import type { Teacher } from "@/pages/teachers/TeacherForm";

const menuItems = [
  { key: "courses", label: "Courses", icon: BookOpenCheck },
  { key: "exams-notes", label: "Exams & Notes", icon: ClipboardList },
  { key: "class", label: "Class", icon: Users },
  { key: "planning", label: "Planning", icon: CalendarDays },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

const pages: Record<MenuKey, React.ReactNode> = {
  courses: <MyCoursesPage />,
  "exams-notes": <ExamsNotesPage />,
  class: <MyClassPage />,
  planning: <PlanningPage />,
};

function clearTeacherSession() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("role");
  localStorage.removeItem("isTeacherLoggedIn");
  localStorage.removeItem("currentTeacherId");
}

export default function TeacherLayout() {
  const [active, setActive] = useState<MenuKey>("courses");
  // undefined = still fetching the record; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const navigate = useNavigate();

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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center px-4 text-lg font-semibold">
          SSM
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
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-muted-foreground">
            {teacher ? (
              <>
                {teacher.fullName}
                <span className="text-xs font-normal">
                  · {teacher.program}
                  {teacher.training ? ` — ${teacher.training}` : ""}
                </span>
              </>
            ) : (
              "Teacher Portal"
            )}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{pages[active]}</main>
      </div>
    </div>
  );
}

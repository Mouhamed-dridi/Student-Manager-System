import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  DollarSign,
  CalendarX,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import CoursesPage from "./CoursesPage";
import MyPaymentsPage from "./MyPaymentsPage";
import MyAttendancePage from "./MyAttendancePage";
import AnnouncementsPage from "./AnnouncementsPage";
import { loadCurrentStudent } from "./currentStudent";

const menuItems = [
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "payments", label: "My Payment", icon: DollarSign },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "absence", label: "Absence", icon: CalendarX },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

const pages: Record<MenuKey, React.ReactNode> = {
  courses: <CoursesPage />,
  payments: <MyPaymentsPage />,
  announcements: <AnnouncementsPage />,
  absence: <MyAttendancePage />,
};

export default function StudentLayout() {
  const [active, setActive] = useState<MenuKey>("courses");
  const [student] = useState(loadCurrentStudent);
  const navigate = useNavigate();

  useEffect(() => {
    // Record may have been deleted after login — end the session.
    if (!student) {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("role");
      localStorage.removeItem("isStudentLoggedIn");
      localStorage.removeItem("currentStudentId");
      navigate("/student/login");
    }
  }, [student, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    localStorage.removeItem("isStudentLoggedIn");
    localStorage.removeItem("currentStudentId");
    navigate("/student/login");
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
          <span className="text-sm font-medium text-muted-foreground">
            {student ? student.fullName : "Student Portal"}
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

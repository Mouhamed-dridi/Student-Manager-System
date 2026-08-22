import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  GraduationCap,
  DollarSign,
  CalendarX,
  BookOpen,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StudentsPage from "@/pages/students/StudentsPage";
import TeachersPage from "@/pages/teachers/TeachersPage";
import PayPage from "@/pages/pay/PayPage";
import AbsencePage from "@/pages/absence/AbsencePage";
import PublicationsPage from "@/pages/publications/PublicationsPage";
import UserManagementPage from "@/pages/users/UserManagementPage";

const menuItems = [
  { key: "students", label: "Students", icon: Users },
  { key: "teachers", label: "Teachers", icon: GraduationCap },
  { key: "pay", label: "Pay", icon: DollarSign },
  { key: "absence", label: "Absence", icon: CalendarX },
  { key: "publications", label: "Publications", icon: BookOpen },
  { key: "users", label: "User Management", icon: UserCog },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

const pages: Record<MenuKey, React.ReactNode> = {
  students: <StudentsPage />,
  teachers: <TeachersPage />,
  pay: <PayPage />,
  absence: <AbsencePage />,
  publications: <PublicationsPage />,
  users: <UserManagementPage />,
};

export default function Layout() {
  const [active, setActive] = useState<MenuKey>("students");
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
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
          <span className="text-sm font-medium text-muted-foreground">
            Student Manager System
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

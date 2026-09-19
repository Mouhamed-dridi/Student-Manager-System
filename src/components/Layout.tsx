import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  CalendarX,
  BookOpen,
  UserCog,
  Trash2,
  Settings,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import StudentsPage from "@/pages/students/StudentsPage";
import TeachersPage from "@/pages/teachers/TeachersPage";
import PayPage from "@/pages/pay/PayPage";
import PaymentHistoryPage from "@/pages/pay/PaymentHistoryPage";
import PaymentTrashPage from "@/pages/pay/PaymentTrashPage";
import AbsencePage from "@/pages/absence/AbsencePage";
import PublicationsPage from "@/pages/publications/PublicationsPage";
import UserManagementPage from "@/pages/users/UserManagementPage";
import GeneralTrashPage from "@/pages/trash/GeneralTrashPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import { clearSession } from "@/lib/session";
import { getSystemName } from "@/lib/api";

type MenuKey =
  | "dashboard"
  | "students"
  | "teachers"
  | "pay"
  | "pay-history"
  | "pay-trash"
  | "absence"
  | "publications"
  | "users"
  | "trash"
  | "settings";

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: LucideIcon;
  children?: { key: MenuKey; label: string }[];
}

const menuItems: MenuItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "students", label: "Students", icon: Users },
  { key: "teachers", label: "Teachers", icon: GraduationCap },
  {
    key: "pay",
    label: "Pay",
    icon: DollarSign,
    children: [
      { key: "pay", label: "Payments" },
      { key: "pay-history", label: "History" },
      { key: "pay-trash", label: "Trash" },
    ],
  },
  { key: "absence", label: "Absence", icon: CalendarX },
  { key: "publications", label: "Publications", icon: BookOpen },
  { key: "users", label: "User Management", icon: UserCog },
  { key: "trash", label: "Trash", icon: Trash2 },
  { key: "settings", label: "Settings", icon: Settings },
];

const pages: Record<MenuKey, React.ReactNode> = {
  dashboard: <DashboardPage />,
  students: <StudentsPage />,
  teachers: <TeachersPage />,
  pay: <PayPage />,
  "pay-history": <PaymentHistoryPage />,
  "pay-trash": <PaymentTrashPage />,
  absence: <AbsencePage />,
  publications: <PublicationsPage />,
  users: <UserManagementPage />,
  trash: <GeneralTrashPage />,
  settings: <SettingsPage />,
};

export default function Layout() {
  const [active, setActive] = useState<MenuKey>("dashboard");
  const [payExpanded, setPayExpanded] = useState(true);
  const [systemName, setSystemName] = useState("SSM");
  const navigate = useNavigate();

  useEffect(() => {
    getSystemName()
      .then(setSystemName)
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const inPaySection =
    active === "pay" || active === "pay-history" || active === "pay-trash";

  const handlePayParentClick = () => {
    if (inPaySection) {
      setPayExpanded((open) => !open);
    } else {
      setPayExpanded(true);
      setActive("pay");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center px-4 text-lg font-semibold">
          {systemName}
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {menuItems.map((item) => {
            if (item.children) {
              const expanded = payExpanded && inPaySection;
              return (
                <div key={item.key}>
                  <button
                    onClick={handlePayParentClick}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      inPaySection
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
            {systemName === "SSM" ? "Student Manager System" : systemName}
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
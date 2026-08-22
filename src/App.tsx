import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import StudentLoginPage from "@/pages/student-portal/StudentLoginPage";
import StudentLayout from "@/pages/student-portal/StudentLayout";
import TeacherLoginPage from "@/pages/teacher-portal/TeacherLoginPage";
import TeacherLayout from "@/pages/teacher-portal/TeacherLayout";

function getRole(): string | null {
  return localStorage.getItem("isLoggedIn") === "true"
    ? localStorage.getItem("role")
    : null;
}

function homeFor(role: string | null) {
  if (role === "student") return "/student";
  if (role === "teacher") return "/teacher";
  return "/dashboard";
}

function OperatorRoute({ children }: { children: React.ReactNode }) {
  const role = getRole();
  return role === "operator" ? (
    <>{children}</>
  ) : (
    <Navigate to={role === "student" ? "/student" : "/login"} replace />
  );
}

function StudentRoute({ children }: { children: React.ReactNode }) {
  const role = getRole();
  return role === "student" ? (
    <>{children}</>
  ) : (
    <Navigate to={role === "operator" ? "/dashboard" : "/student/login"} replace />
  );
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const role = getRole();
  return role === "teacher" ? (
    <>{children}</>
  ) : (
    <Navigate
      to={
        role === "operator"
          ? "/dashboard"
          : role === "student"
            ? "/student"
            : "/teacher/login"
      }
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          getRole() === null ? (
            <LoginPage />
          ) : (
            <Navigate to={homeFor(getRole())} replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <OperatorRoute>
            <DashboardPage />
          </OperatorRoute>
        }
      />
      <Route
        path="/student/login"
        element={
          getRole() === null ? (
            <StudentLoginPage />
          ) : (
            <Navigate to={homeFor(getRole())} replace />
          )
        }
      />
      <Route
        path="/student"
        element={
          <StudentRoute>
            <StudentLayout />
          </StudentRoute>
        }
      />
      <Route
        path="/teacher/login"
        element={
          getRole() === null ? (
            <TeacherLoginPage />
          ) : (
            <Navigate to={homeFor(getRole())} replace />
          )
        }
      />
      <Route
        path="/teacher"
        element={
          <TeacherRoute>
            <TeacherLayout />
          </TeacherRoute>
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={
              getRole() === "student"
                ? "/student"
                : getRole() === "teacher"
                  ? "/teacher"
                  : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

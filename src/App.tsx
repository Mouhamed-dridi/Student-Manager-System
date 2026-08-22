import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import StudentLoginPage from "@/pages/student-portal/StudentLoginPage";
import StudentLayout from "@/pages/student-portal/StudentLayout";

function getRole(): string | null {
  return localStorage.getItem("isLoggedIn") === "true"
    ? localStorage.getItem("role")
    : null;
}

function homeFor(role: string | null) {
  return role === "student" ? "/student" : "/dashboard";
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
        path="*"
        element={
          <Navigate to={getRole() === "student" ? "/student" : "/login"} replace />
        }
      />
    </Routes>
  );
}

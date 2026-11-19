import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import StudentLayout from "@/pages/student-portal/StudentLayout";
import TeacherLayout from "@/pages/teacher-portal/TeacherLayout";
import { LicenseLockScreen } from "@/components/LicenseLockScreen";
import {
  refreshLicense,
  useLicense,
  watchLicenseChanges,
} from "@/lib/licenseStore";
import { getRole } from "@/lib/session";

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
    <Navigate to={role === "operator" ? "/dashboard" : "/login"} replace />
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
            : "/login"
      }
      replace
    />
  );
}

/**
 * Full-app license gate.
 *
 * Reads `center_settings` row id = 1 before anything else renders and swaps the
 * whole route tree for the lock screen when `license_expires_at` is missing or
 * in the past. The gate is re-evaluated by the shared license store, so
 * activating a key on the lock screen (or in Settings, or in another tab over
 * the realtime channel) unlocks the workspace without a reload.
 */
function LicenseGate({ children }: { children: React.ReactNode }) {
  const { loaded, locked, expiresAt, error } = useLicense();

  useEffect(() => {
    void refreshLicense();
    return watchLicenseChanges();
  }, []);

  // A cached, still-valid expiry renders the app immediately while the row is
  // re-read in the background; anything else waits for the authoritative read
  // instead of flashing the workspace for an expired license.
  if (!loaded && locked) return <LicenseLockScreen mode="checking" />;

  if (locked) {
    return (
      <LicenseLockScreen
        mode="locked"
        expiresAt={expiresAt}
        readError={error}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <LicenseGate>
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
          path="/student"
          element={
            <StudentRoute>
              <StudentLayout />
            </StudentRoute>
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
    </LicenseGate>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Student } from "@/pages/students/StudentForm";
import { hasAccount } from "@/pages/users/userAccounts";

const BLOCKED_MESSAGE = "Access has been blocked by the center.";
const INVALID_MESSAGE = "Invalid student name or password.";
const NO_ACCOUNT_MESSAGE =
  "No active account for this student. Please contact the administration.";

function loadStudents(): Student[] {
  try {
    const parsed: Student[] = JSON.parse(
      localStorage.getItem("students") ?? "[]",
    );
    return parsed.map((s) => ({ ...s, training: s.training ?? "" }));
  } catch {
    return [];
  }
}

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check order matters: a blocked student is rejected even with
    // the correct name and password.
    const query = fullName.trim().toLowerCase();
    const student = loadStudents().find(
      (s) => s.fullName.trim().toLowerCase() === query,
    );

    if (!student) {
      setError(INVALID_MESSAGE);
      return;
    }
    if (student.blocked === true) {
      setError(BLOCKED_MESSAGE);
      return;
    }
    if (!hasAccount(student)) {
      setError(NO_ACCOUNT_MESSAGE);
      return;
    }
    if (student.password !== password) {
      setError(INVALID_MESSAGE);
      return;
    }

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "student");
    localStorage.setItem("isStudentLoggedIn", "true");
    localStorage.setItem("currentStudentId", student.id);
    navigate("/student");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">
            SSM Student Login
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Student } from "@/pages/students/StudentForm";

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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username !== "std" || password !== "std123") {
      setError("Invalid username or password.");
      return;
    }

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "student");
    localStorage.setItem("isStudentLoggedIn", "true");

    const students = loadStudents();
    if (students.length === 1) {
      // Only one account exists — skip the picker.
      localStorage.setItem("currentStudentId", students[0].id);
      navigate("/student");
    } else {
      navigate("/student/pick");
    }
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Teacher } from "@/pages/teachers/TeacherForm";

const INCORRECT_MESSAGE = "Incorrect full name or password.";

function loadTeachers(): Teacher[] {
  try {
    const parsed: Teacher[] = JSON.parse(
      localStorage.getItem("teachers") ?? "[]",
    );
    return parsed;
  } catch {
    return [];
  }
}

export default function TeacherLoginPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const query = fullName.trim();
    const teacher = loadTeachers().find((t) => t.fullName.trim() === query);

    if (!teacher || teacher.password !== password) {
      setError(INCORRECT_MESSAGE);
      return;
    }

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("role", "teacher");
    localStorage.setItem("isTeacherLoggedIn", "true");
    localStorage.setItem("currentTeacherId", teacher.id);
    navigate("/teacher");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">
            SSM Teacher Login
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

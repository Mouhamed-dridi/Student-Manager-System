import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { errorMessage, listStudents, listTeachers } from "@/lib/api";

const BLOCKED_MESSAGE = "Access has been blocked by the center.";
const INVALID_MESSAGE = "Incorrect name or password.";

export default function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const query = name.trim();

    if (query === "admin" && password === "admin123") {
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("role", "operator");
      navigate("/dashboard");
      return;
    }

    setSubmitting(true);
    try {
      const [teachers, students] = await Promise.all([
        listTeachers(),
        listStudents(),
      ]);

      const teacher = teachers.find((t) => t.fullName.trim() === query);
      if (teacher && teacher.password === password) {
        if (teacher.blocked === true) {
          setError(BLOCKED_MESSAGE);
          return;
        }
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("role", "teacher");
        localStorage.setItem("isTeacherLoggedIn", "true");
        localStorage.setItem("currentTeacherId", teacher.id);
        navigate("/teacher");
        return;
      }

      const student = students.find(
        (s) => s.fullName.trim().toLowerCase() === query.toLowerCase(),
      );
      if (student && student.password === password) {
        if (student.blocked === true) {
          setError(BLOCKED_MESSAGE);
          return;
        }
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("role", "student");
        localStorage.setItem("isStudentLoggedIn", "true");
        localStorage.setItem("currentStudentId", student.id);
        navigate("/student");
        return;
      }

      setError(INVALID_MESSAGE);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">SSM Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Checking…" : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";

export default function TeacherLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium">Teacher portal</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The dashboard sections (Courses, Exams, Grades, My Class) will
            appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

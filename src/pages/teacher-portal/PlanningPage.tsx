import { Card, CardContent } from "@/components/ui/card";

export default function PlanningPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Planning</h2>
      <Card className="mt-4 max-w-xl">
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium">Nothing planned yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your schedule will appear here once sessions are planned for your
            class.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { Loader2 } from "lucide-react";

export function DataLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

// Rendering for one attached course material ({name, type, url}): videos play
// inline, PDFs open in a viewer, everything else is offered as a download.
// Shared by the teacher portal's CourseDetail and the student portal's
// StudentCourseDetail so a material always looks the same in both.

import { CirclePlay, Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CourseMaterial } from "@/lib/trainings";
import { materialKind } from "@/lib/courseBuckets";

function materialTypeLabel(type: string): string {
  if (type.startsWith("video/")) return "Video";
  if (type === "application/pdf") return "PDF";
  if (type.includes("word") || type.includes("document")) return "Word document";
  return type || "File";
}

// Course files live in the public cours-covers / cours-PDF / cours-videos
// buckets, so plain public URLs are enough — no signed URLs. The HTML download
// attribute is ignored for cross-origin links, so a real download goes through
// Supabase's ?download=<filename> query parameter instead.
function downloadUrlFor(url: string, fileName: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("download", fileName);
    return parsed.toString();
  } catch {
    return url;
  }
}

function MaterialActions({ material }: { material: CourseMaterial & { url: string } }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        render={<a href={material.url} target="_blank" rel="noreferrer" />}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={<a href={downloadUrlFor(material.url, material.name)} />}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </Button>
    </div>
  );
}

export function MaterialItem({ material }: { material: CourseMaterial }) {
  const kind = materialKind(material.name, material.type);
  const url = material.url;
  const Icon = kind === "video" ? CirclePlay : FileText;
  const attached = typeof url === "string" && url.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{material.name}</span>
        </CardTitle>
        <CardDescription>
          {materialTypeLabel(material.type)}
          {!attached ? " · no file attached" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!attached ? (
          <p className="text-sm text-muted-foreground">
            This material was saved before file uploads were available, so the
            file itself is not available. Ask your teacher to attach it again.
          </p>
        ) : kind === "video" ? (
          <>
            <video
              controls
              preload="metadata"
              src={url}
              className="aspect-video w-full rounded-lg bg-black"
            >
              Your browser cannot play this video.
            </video>
            <MaterialActions material={{ ...material, url }} />
          </>
        ) : kind === "pdf" ? (
          <>
            <iframe
              title={material.name}
              src={url}
              className="h-[70vh] min-h-[480px] w-full rounded-lg border bg-background"
            />
            <MaterialActions material={{ ...material, url }} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This file type cannot be previewed in the browser.
            </p>
            <MaterialActions material={{ ...material, url }} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

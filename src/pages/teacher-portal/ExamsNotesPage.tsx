import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExamsPage from "./ExamsPage";
import GradesPage from "./GradesPage";

type SectionKey = "exams" | "notes";

export default function ExamsNotesPage() {
  const [section, setSection] = useState<SectionKey>("exams");

  return (
    <div>
      <Tabs
        value={section}
        onValueChange={(value) => setSection((value as SectionKey) ?? "exams")}
      >
        <TabsList>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="exams">
          <ExamsPage />
        </TabsContent>
        <TabsContent value="notes">
          <GradesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

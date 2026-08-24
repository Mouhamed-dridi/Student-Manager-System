import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExamsPage from "./ExamsPage";
import GradesPage from "./GradesPage";

type SectionKey = "exams" | "grades";

export default function ExamsNotesPage() {
  const [section, setSection] = useState<SectionKey>("exams");

  return (
    <div>
      <Tabs
        value={section}
        onValueChange={(value) => setSection((value as SectionKey) ?? "exams")}
      >
        <TabsList>
          <TabsTrigger value="exams">Add Exam</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>
        <TabsContent value="exams">
          <ExamsPage />
        </TabsContent>
        <TabsContent value="grades">
          <GradesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useState } from "react";
import { errorMessage, listExams } from "@/lib/api";
import type { Teacher } from "@/pages/teachers/TeacherForm";
import type { ExamRecord } from "./exams";
import { loadCurrentTeacher } from "./currentTeacher";

/**
 * Loads the signed-in teacher and the exams list, shared by the Create Exam,
 * Exams Table and Exam Score sections. Each section remounts on navigation, so
 * every switch re-reads the live table.
 */
export function useTeacherExams() {
  // undefined = session record still loading; null = record is gone.
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [exams, setExams] = useState<ExamRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurrentTeacher()
      .then(async (record) => {
        if (cancelled || !record) {
          if (!cancelled) setTeacher(record ?? null);
          return;
        }
        setTeacher(record);
        try {
          const all = await listExams();
          if (!cancelled) setExams(all);
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        }
      })
      .catch(() => {
        if (!cancelled) setTeacher(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const myExams = (exams ?? [])
    .filter((e) => e.teacherId === teacher?.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const refresh = async () => {
    try {
      setError(null);
      setExams(await listExams());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return { teacher, exams, myExams, error, setError, refresh };
}

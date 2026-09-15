import AttendanceLog from "./AttendanceLog";

export default function AbsencePage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Attendance</h2>

      <div className="mt-4">
        <AttendanceLog />
      </div>
    </div>
  );
}
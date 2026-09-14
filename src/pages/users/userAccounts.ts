export type AccountKind = "students" | "teachers";

// Login passwords default by account kind.
export const DEFAULT_TEACHER_PASSWORD = "tch123";
export const DEFAULT_STUDENT_PASSWORD = "std123";

export function defaultAccountPassword(kind: AccountKind): string {
  return kind === "teachers"
    ? DEFAULT_TEACHER_PASSWORD
    : DEFAULT_STUDENT_PASSWORD;
}

// Structural view of any record that can own a login account. The index
// signature keeps every other field (program, phone, ...) intact on write.
export interface AccountRecord {
  id: string;
  fullName?: string;
  password?: string;
  blocked?: boolean;
  [key: string]: unknown;
}

// "Has an account" simply means the record carries a password. The schema
// makes `password` NOT NULL, and deleting an account sets it to NULL, so a
// non-null (even empty-string) password is an account.
export function hasAccount(record: { password?: string }): boolean {
  return record.password != null;
}

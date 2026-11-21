export type AccountKind = "students" | "teachers";

// The User Management page swaps between the two people tables and a third,
// not-yet-persisted operators/admins space.
export type AccountTab = AccountKind | "operators";

// Display roles. Students/teachers have exactly one (their record type); the
// operator space is the only place where Admin vs Operator is a real choice.
export type AccountRole = "admin" | "operator" | "teacher" | "student";

// Keys are the English dictionary copy, so `t(ROLE_LABEL_KEYS[role])` works.
export const ROLE_LABEL_KEYS: Record<AccountRole, string> = {
  admin: "Admin",
  operator: "Operator",
  teacher: "Teacher",
  student: "Student",
};

export const OPERATOR_ROLES: AccountRole[] = ["admin", "operator"];

export function roleForKind(kind: AccountKind): AccountRole {
  return kind === "teachers" ? "teacher" : "student";
}

export function rolesForKind(kind: AccountKind | "operators"): AccountRole[] {
  return kind === "operators" ? OPERATOR_ROLES : [roleForKind(kind)];
}

// Login passwords default by account kind.
export const DEFAULT_TEACHER_PASSWORD = "tch123";
export const DEFAULT_STUDENT_PASSWORD = "std123";
export const DEFAULT_OPERATOR_PASSWORD = "opr123";

export function defaultAccountPassword(kind: AccountKind): string {
  return kind === "teachers"
    ? DEFAULT_TEACHER_PASSWORD
    : DEFAULT_STUDENT_PASSWORD;
}

// No ambiguous glyphs (0/O, 1/l/I) — these passwords get read aloud and typed
// by hand, so legibility beats raw entropy here.
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Generates a readable random password (12 characters by default). */
export function generatePassword(length = 12): string {
  const values = new Uint32Array(length);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) {
      values[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  return Array.from(
    values,
    (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length],
  ).join("");
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

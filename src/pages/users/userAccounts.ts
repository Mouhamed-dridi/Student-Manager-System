export const DEFAULT_ACCOUNT_PASSWORD = "std123";

export type AccountKind = "students" | "teachers";

// Structural view of any record that can own a login account. The index
// signature keeps every other field (program, phone, ...) intact on write.
export interface AccountRecord {
  id: string;
  fullName?: string;
  password?: string;
  blocked?: boolean;
  [key: string]: unknown;
}

export function hasAccount(record: { password?: string }): boolean {
  return typeof record.password === "string" && record.password.length > 0;
}

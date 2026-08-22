export const DEFAULT_ACCOUNT_PASSWORD = "std123";

export type AccountKind = "students" | "teachers";

// Structural view of any record that can own a login account. The index
// signature keeps every other field (program, phone, ...) intact on write.
export interface AccountRecord {
  id: string;
  fullName?: string;
  password?: string;
  blocked?: boolean;
  accountInitialized?: boolean;
  [key: string]: unknown;
}

const STORAGE_KEYS: Record<AccountKind, string> = {
  students: "students",
  teachers: "teachers",
};

function readRecords(kind: AccountKind): AccountRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS[kind]) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(kind: AccountKind, records: AccountRecord[]) {
  localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(records));
}

function updateRecord(
  kind: AccountKind,
  id: string,
  update: (record: AccountRecord) => AccountRecord,
) {
  const records = readRecords(kind).map((r) => (r.id === id ? update(r) : r));
  writeRecords(kind, records);
}

export function loadStudents(): AccountRecord[] {
  return readRecords("students").map((r) => ({
    ...r,
    training: r.training ?? "",
  }));
}

export function loadTeachers(): AccountRecord[] {
  return readRecords("teachers").map((r) => ({
    ...r,
    training: r.training ?? "",
  }));
}

export function hasAccount(record: { password?: string }): boolean {
  return typeof record.password === "string" && record.password.length > 0;
}

export function toggleBlocked(kind: AccountKind, id: string) {
  updateRecord(kind, id, (r) => ({ ...r, blocked: !r.blocked }));
}

export function resetPassword(
  kind: AccountKind,
  id: string,
  password: string,
) {
  updateRecord(kind, id, (r) => ({
    ...r,
    password,
    accountInitialized: true,
  }));
}

export function createAccount(
  kind: AccountKind,
  id: string,
  password: string,
) {
  updateRecord(kind, id, (r) => ({
    ...r,
    password,
    accountInitialized: true,
  }));
}

// Removes login access only — the rest of the record stays intact.
// Deliberately KEEPS accountInitialized so the boot seed recognizes this
// as "account deliberately removed" (never refills std123), not as
// "never had an account".
export function deleteAccount(kind: AccountKind, id: string) {
  updateRecord(kind, id, (r) => {
    const next = { ...r };
    delete next.password;
    delete next.blocked;
    return next;
  });
}

// Runs on every app start for both students and teachers. Fills in the
// default password ONLY for records that never had one: blank password AND
// accountInitialized never set. Records whose account was deleted keep the
// initialized marker, so their blank password stays blank.
export function ensureDefaultPasswords() {
  for (const kind of ["students", "teachers"] as const) {
    const records = readRecords(kind);
    const needsSeed = records.some(
      (r) => !r.password && r.accountInitialized !== true,
    );
    if (!needsSeed) continue;
    writeRecords(
      kind,
      records.map((r) =>
        !r.password && r.accountInitialized !== true
          ? {
              ...r,
              password: DEFAULT_ACCOUNT_PASSWORD,
              accountInitialized: true,
            }
          : r,
      ),
    );
  }
}

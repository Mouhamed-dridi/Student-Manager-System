---
description: Verify live Supabase schema before making any code changes
agent: build
---

Before writing or editing any code, you must first verify the actual current
state of the Supabase database — never assume table structure from memory,
from an old schema.sql file, or from what the code appears to expect.

Steps to follow every time this command is used:

1. List every table currently relevant to this task.
2. For each one, check its real columns — either by reading a schema.sql
   file ONLY if I confirm it's up to date, or by asking me to paste the
   actual column list from Supabase's Table Editor if you're not certain.
3. Do not guess or assume a column exists (like a foreign key vs. plain
   text field) — if you're unsure, ask me directly instead of picking
   the "most likely" option.
4. Only after the real structure is confirmed, write a short plan of what
   code needs to change and where.
5. Then implement the fix.
6. After implementing, tell me exactly what to test to confirm it worked.

Task for this run: $ARGUMENTS

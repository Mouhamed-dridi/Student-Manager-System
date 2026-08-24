# Accessing SSM

Start the app first:

```
npm run dev
```

Then open **http://localhost:5173** in your browser.

There is ONE login page for all three roles: `/login` → http://localhost:5173/login. It is a single form asking for a **name** and a **password** — no role selector. On submit the app checks, in order:

1. **Admin**: name `admin` + password `admin123` → operator dashboard.
2. **Teachers**: your full name (case does not matter) + password.
3. **Students**: your full name (case does not matter) + password.
4. Anything else shows one generic "Incorrect name or password." error.

All data lives in your browser's localStorage — clearing site data resets every account.

## 1. Operator (Admin) Dashboard

| | |
|---|---|
| **Login** | `admin` |
| **Password** | `admin123` |

The only account that works out of the box — hardcoded in `src/pages/LoginPage.tsx`. The admin manages everything from here: Students, Teachers, Pay, Absence, Publications, and User Management (creating/blocking accounts, resetting passwords).

## 2. Teacher Portal

| | |
|---|---|
| **Login** | The teacher's **full name** (case does not matter) |
| **Password** | Set by the admin — default is `std123` |

Important: no teachers exist until you create one. To create a teacher:

1. Log in as admin (above).
2. Go to **Teachers** → **Add Teacher**.
3. Fill the form. The Password field comes prefilled with `std123` — keep it or type your own.
4. Log in at `/login` using that full name + password.

Example: if you added "Sami Bouzid" with password `std123`, you can log in with `Sami Bouzid`, `sami bouzid`, or any other capitalization — the name just needs to match letter-for-letter, and the password must be exact.

## 3. Student Portal

| | |
|---|---|
| **Login** | The student's **full name** (case does not matter) |
| **Password** | The student's personal password — default is `std123` |

Students must also exist before they can log in. To create a student:

1. Log in as admin.
2. Go to **Students** → **Add Student**.
3. Fill the form (the password defaults to `std123`).
4. Log in at `/login` with that student's full name + password.

Note: an account marked **Blocked** by the admin cannot log in even with the correct name and password — it sees "Access has been blocked by the center." With a wrong password the generic error is shown instead.

## Quick Reference

All roles use the same page: **http://localhost:5173/login**

| Role | Username | Default password |
|---|---|---|
| Admin/Operator | `admin` | `admin123` |
| Teacher | Full name (any case) | `std123` |
| Student | Full name (any case) | `std123` |

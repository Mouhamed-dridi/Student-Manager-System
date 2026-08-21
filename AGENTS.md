# AGENTS.md

Frontend-only React 19 + Vite 8 + TypeScript SPA ("SSM"). No backend, no tests, no CI.

## Commands

- Dev server: `npm run dev` (or `RUN.bat`)
- Lint: `npm run lint` (oxlint — there is no ESLint)
- Typecheck/build: `npm run build` runs `tsc -b && vite build`. There is no separate typecheck script; use `npx tsc -b` to typecheck alone.
- Verify changes with `npm run lint`, then `npx tsc -b`. No test framework exists — do not invent test commands.

## Architecture

- Only two router routes exist: `/login` and `/dashboard` (`src/App.tsx`). The five sections — students, teachers, pay, absence, publications — are NOT routes; they swap via `useState` inside `src/components/Layout.tsx`. To add a section, update its `menuItems` and `pages` maps.
- All persistence is browser localStorage: fake auth via `isLoggedIn`/`role` keys (read by route guards in `src/App.tsx`), and entity lists keyed by simple names (e.g. `students` in `src/pages/students/StudentsPage.tsx`). Clearing site data resets everything.
- Feature folders live in `src/pages/<feature>/` as `<Feature>Page.tsx` plus list/form subcomponents.

## Stack quirks

- Tailwind v4 via `@tailwindcss/vite`: there is intentionally no tailwind.config.js. Theme tokens and colors are defined in `src/index.css` (`@theme inline` block); edit CSS there instead of creating a config file.
- shadcn/ui uses the Base UI flavor (`style: base-nova` in components.json): components in `src/components/ui/` wrap `@base-ui/react`, not Radix. Add new primitives with `npx shadcn add <component>`; icons come from lucide-react.
- Path alias `@/*` → `src/*` (must stay in sync in both `vite.config.ts` and `tsconfig.app.json`).
- TS settings shape code style: `verbatimModuleSyntax` (types need `import type`), `erasableSyntaxOnly` (no enums, namespaces, or parameter properties), plus `noUnusedLocals`/`noUnusedParameters`.

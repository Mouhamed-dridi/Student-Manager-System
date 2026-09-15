# Project Information: Student Manager System

## Overview
The Student Manager System is a comprehensive web application designed to manage the daily operations of an educational center. It streamlines tasks related to student enrollments, teacher assignments, course scheduling, attendance tracking, exam grading, and payment management.

## Target Client
The primary clients for this system are educational institutions, training centers, tutoring schools, and academies. The application supports three main user roles:
*   **Operator (Admin):** Manages the entire center, including user accounts, overall attendance, financial payments, and system-wide announcements.
*   **Teacher:** Manages their specific courses, exams, student grades, and views their personal schedule and attendance.
*   **Student:** Accesses their enrolled courses, views grades and attendance history, checks personal payments, and reads center announcements.

## Tech Stack
The project is built as a Single Page Application (SPA) using a modern, fast, and type-safe stack:
*   **Core Framework:** React 19
*   **Language:** TypeScript
*   **Build Tool:** Vite 8
*   **Backend & Database:** Supabase (PostgreSQL with Row Level Security for data access)
*   **Routing:** React Router DOM v7
*   **Data Export & Parsing:** SheetJS (Excel) and jsPDF (PDF)
*   **Linting:** oxlint

## Design and UI Framework
The application features a modern and responsive design system:
*   **CSS Framework:** Tailwind CSS v4
*   **UI Components:** shadcn/ui (using the Base UI flavor)
*   **Typography:** Geist Variable (sans-serif)
*   **Color Palette:** The design utilizes an OKLCH color space defining a clean, neutral theme with built-in support for both Light and Dark modes. The theme relies on subtle grayscale contrast for standard elements and distinct OKLCH values for specific UI states (like destructive actions and charts).
*   **Animations:** Integrated micro-animations using tw-animate-css for a dynamic user experience.

## Architecture Highlights
*   **Frontend-Only Architecture:** The application connects directly to Supabase via secure API calls. There is no separate backend server.
*   **Session Management:** User sessions (role, student ID, teacher ID) are handled via cookies rather than localStorage.
*   **Realtime Updates:** Key pages subscribe to Supabase Realtime to update data automatically when changes occur on the backend.

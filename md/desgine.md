# Design Document

## UI/UX Principles
The application focuses on a clean, modern, and highly responsive user interface, typical of premium lifestyle and food apps.

## Key Design Components
1. **Navigation:**
   - **Persistent Bottom Navigation:** A sticky bottom navigation bar allows users to switch between main sections like 'Recipes', 'Plan', and 'Settings' without losing their nested navigation state.
2. **Loading States:**
   - **Shimmer Effects:** Instead of traditional circular loading indicators, the app uses shimmer skeleton screens when loading recipe data to make the wait feel shorter and the app feel more responsive.
3. **Structure (lib/ folder):**
   - `navbar/`: Contains the logic and UI for the main application navigation.
   - `planify/`: Contains the screens and widgets specific to the meal planning feature.
   - `recipes/`: Contains the screens for browsing and viewing recipe details.
   - `widgets/`: A shared library of reusable UI components (buttons, cards, inputs) to maintain design consistency.

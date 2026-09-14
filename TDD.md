# TDD.md - Technical Design Document

**Project:** Parking Plus
**Type:** Fleet Management SaaS Web Application
**Stack:** Angular 17 (standalone components) + NG-ZORRO Ant Design + Ant Design Icons + jsPDF
**Data Layer:** Fully in-memory (no backend API)
**Date:** 2026-06-05

---

## 1. Introduction

This Technical Design Document (TDD) describes the architecture, component design, data flow, and feature workflows of the **Parking Plus** application. It is organized around the **12 application features / 11 functional swim lanes** identified in the project workflow diagram:

1. Authentication and Session
2. Navigation and Layout
3. Dashboard and Fleet Overview
4. Vehicle Management
5. Driver Management
6. Booking Management
7. Maintenance and Repairs
8. Garage CRM
9. Reports and Analytics
10. Trash and Recovery
11. Settings and Preferences
12. User Management

**Audience:** Developers maintaining or extending the codebase; QA testers verifying feature behavior end-to-end.

---

## 2. System Architecture

### 2.1 High-Level Component Tree
```
AppComponent (host)
└── <router-outlet>
    ├── /login                  → LoginComponent (standalone, external template)
    └── <MainLayoutComponent>   → wraps everything else
        ├── <app-sidebar>       (collapsible navigation)
        ├── <app-header>        (user dropdown, theme)
        └── <router-outlet>     → 14 feature components
```

### 2.2 State Management
- All state lives in **singleton services** decorated with `@Injectable({ providedIn: 'root' })`.
- Services expose **plain CRUD methods** returning either arrays (with spread copy to prevent mutation) or `void` for writes.
- No observables, no `BehaviorSubject`, no NgRx — components call service methods directly in `ngOnInit` and on user actions.

### 2.3 Data Persistence
- **All data is in-memory.** Every page refresh resets the app to its seed state.
- `localStorage` is used only for the auth flag (`isLoggedIn`) and the theme preference (`parkingplus-theme`).
- No HTTP calls. No real file uploads. No backend.

### 2.4 Icon Registration
27 Ant Design icons are registered in `src/app/app.config.ts:22-29`. Unregistered icons render blank and fall back to the CDN.

---

## 3. Routing Map

| Path | Component | Route Data |
|------|-----------|------------|
| `''` | redirect → `/login` | — |
| `login` | `LoginComponent` | — |
| `listing` | `ListingComponent` | `{ vehicleType: 'Car' }` |
| `delivery-cars` | `ListingComponent` | `{ vehicleType: 'Delivery' }` |
| `used-car` | `ListingComponent` | `{ vehicleType: 'Used' }` |
| `listing/:id` | `CarDetailsComponent` | — |
| `drivers` | `DriversComponent` | — |
| `drivers/:id` | `DriverProfileComponent` | — |
| `request-car` | `RequestCarComponent` | — |
| `booking-list` | `BookingListComponent` | — |
| `repairs` | `RepairsComponent` | — |
| `garage-crm` | `GarageCrmComponent` | — |
| `dashboard` | `DashboardComponent` | — |
| `reports` | `ReportsComponent` | — |
| `trash` | `TrashComponent` | — |
| `settings` | `SettingsComponent` | — |
| `user-management` | `UserManagementComponent` | — |

All routes except `/login` are children of `MainLayoutComponent`. **An `authGuard` exists at `src/app/core/guards/auth.guard.ts` but is NOT wired into the route config.**

---

## 4. Data Models

### 4.1 `CarData` (shared card model)
```ts
{ id, name, image, driver: { name, avatar }, driverId?, type, transmission, fuel, price, status? }
```

### 4.2 `CarDetail` (extends CarData)
```ts
{ ...CarData, specs: CarSpecs, maintenanceHistory?: MaintenanceRecord[], trips?: TripRecord[] }
```

### 4.3 `CarSpecs`
Object with 12 sections, each a `[{label, value}]` array:
`caracteristiques, motorisation, transmission, dimensions, performances, consommation, securite, aidesConduite, exterieur, audio, interieur, fonctionnels`

### 4.4 `CarFinanceRecord`
```ts
{ carId, carName, price, achatDate, deliveryDate, insurance, insuranceMargin,
  vignetteTax, provider, immoId, carteGriseId, notes }
```

### 4.5 `CarDocument`
```ts
{ id, carId, fileName, documentType, notes, uploadDate }
```

### 4.6 `Driver`
```ts
{ id, name, email, avatar, role, region, subRegion, groups: string[],
  status: 'Active' | 'Inactive', carState: 'in road' | 'free' | 'apsnet' | 'blocked',
  phone, license, vehicle, carRefId, trips, rating, checked? }
```

### 4.7 `Booking`
```ts
{ id, refId, name, email, phone, department, purpose, vehicleName, vehicleType,
  hasLicense, hasShellCard, source, destination, departureTime, arrivalTime, createdAt }
```

### 4.8 `TrashItem`
```ts
{ id, type: 'driver' | 'car' | 'booking' | 'provider' | 'document',
  name, data: any, deletedAt: Date }
```

### 4.9 `Provider` (Garage CRM)
```ts
{ id, name, image, website, location, phone, email, serviceType }
```

### 4.10 `Repair`
```ts
{ id, plate, brand, model, year, image, issue, repairType,
  status: 'Waiting' | 'In Progress' | 'Completed' | 'Cancelled',
  reportedDate, startDate, expectedDate, garage, technician,
  estimatedCost, actualCost?, priority: 'High' | 'Medium' | 'Low',
  duration?, fixStatus?: 'Still in Fix' | 'Fixed' | 'Not Going to Fix Yet',
  documentFile?, documentName? }
```

---

## 5. Service Layer

| Service | Methods | Seed Size |
|---------|---------|-----------|
| `CarService` | `getCars`, `getCarsByType`, `getCarById`, `addCar`, `updateCarDriver`, `defaultSpecs` | 12 cars |
| `CarFinanceService` | `getByCarId`, `getAll`, `save`, `delete` | 12 records |
| `CarDocumentService` | `getByCarId`, `getAll`, `save`, `delete` | 15 documents |
| `DriverService` | `getAll`, `getById`, `save`, `delete` | 8 drivers |
| `BookingService` | `addBooking`, `getBookings`, `generateRefId` | 0 (empty) |
| `TrashService` | `addItem`, `getItems`, `restoreItem`, `permanentDelete`, `clearAll` | 0 (empty) |
| `ThemeService` | `toggleTheme`, `isDarkMode` | n/a |

**Constants:**
- `ASSURANCE_LIST` — 10 Tunisian insurers
- `PROVIDER_LIST` — 10 vehicle manufacturers
- `DOCUMENT_TYPE_LIST` — 8 doc types

---

## 6. Feature Workflows

The 12 features below correspond directly to the 11 swim lanes in the workflow diagram. Each feature is documented with **trigger → steps → outcome → file references → edge cases**.

---

### 6.1 Authentication and Session

**Trigger:** User opens the app or refreshes any page.

**Steps:**
1. Application loads at `/login` (default route is `redirectTo: 'login'`).
2. User enters `admin` / `admin` (hardcoded).
3. Login component validates: fields non-empty, username alphabet-only, credentials match.
4. On success: `isLoading = true` for 600 ms, then `localStorage.setItem('isLoggedIn', 'true')` and navigate to `/dashboard`.
5. `MainLayoutComponent` renders the sidebar + header.

**Outcomes:**
- ✅ Successful login → Dashboard.
- ❌ Wrong credentials → error message displayed.
- ❌ Empty fields → "Please fill all fields" message.
- ❌ Non-alphabet username → validation error.

**Files:**
- `src/app/features/auth/login/login.component.ts`
- `src/app/features/auth/login/login.component.html`
- `src/app/core/guards/auth.guard.ts` (exists but unused)

**Edge Cases:**
- Auth guard is NOT wired — protected routes can be accessed directly via URL.
- Logout from the header dropdown does NOT clear the localStorage flag.
- Page refresh after login keeps the user logged in (flag persists).

---

### 6.2 Navigation and Layout

**Trigger:** After login, or from any protected route.

**Steps:**
1. User is redirected to `/dashboard`.
2. Layout renders: sidebar (256 px, collapsible) + header (56 px) + content area.
3. **User expands the sidebar** → submenu reveals (Vehicles, Maintenance).
4. **User toggles the sidebar** → collapses to icons only.
5. **User selects a module** from the sidebar → router navigates → component loads in `<router-outlet>`.
6. Active route gets a blue left border + blue background highlight.

**Menu Structure:**
- **Menu:** Dashboard · Vehicles (Cars / Delivery / Used Cars) · Drivers · Booking · Booking List · Maintenance (Repairs / Garage CRM)
- **System:** User Management · Reports · Trash · Settings

**Files:**
- `src/app/core/components/layout/main-layout.component.ts`
- `src/app/core/components/sidebar/sidebar.component.ts`
- `src/app/core/components/header/header.component.ts`

**Edge Cases:**
- The header toggle button is not bound to a click handler in the current template (collapse only works via programmatic input).
- No breadcrumb component.

---

### 6.3 Dashboard and Fleet Overview

**Trigger:** Login lands here, or user clicks "Dashboard" in sidebar.

**Steps:**
1. Application displays the dashboard with 3 KPI cards, 2 charts, top vehicles list, and vehicle status panel.
2. User reviews fleet counts (Total Fleet Vehicles, Active Drivers, Pending Requests).
3. User hovers over chart legend items to inspect the SVG combo chart.

**Files:**
- `src/app/features/dashboard/dashboard.component.ts`
- Pulls live counts from `CarService.getCars()`.

**Edge Cases:**
- All KPI values are hardcoded (24 / 15 / 8) — they do NOT derive from real services.
- Charts are inline SVG with Catmull-Rom splines; no chart library.

---

### 6.4 Vehicle Management

**Trigger:** Sidebar → Vehicles → Cars / Delivery / Used Cars.

**Steps:**
1. **User selects Vehicles from the sidebar** → submenu reveals.
2. **Application displays the listing** — filtered by `route.data.vehicleType`.
3. User can:
   - **Select a vehicle card** → navigates to `/listing/:id` (CarDetailsComponent).
   - **Add a car** via the "Add Car" button (name, type, transmission, fuel, driver name, image upload).
4. **Inside Car Details** (6 tabs):
   - **Fiche Technique** — read-only specs (12 sections).
   - **Maintenance** — table of past service records.
   - **Trips History** — table of past trips.
   - **Finance** — 9-card grid; **Edit** opens modal to update price, dates, insurance, provider, vignette tax, immo ID, carte grise ID, notes.
   - **Documents** — table; **Add / Edit / View / Delete** documents. Delete moves item to Trash first.
   - **Driver** — shows assigned driver; **Assign Driver** opens a dropdown modal to pick from 8 drivers.
5. **User saves the finance info** → `CarFinanceService.save()` → toast / success.
6. **User manages a document** → `CarDocumentService.save()` or `delete()` (with trash).
7. **Application updates the car's driver** via `CarService.updateCarDriver()`.

**Files:**
- `src/app/features/listing/listing.component.ts`
- `src/app/features/car-details/car-details.component.ts`
- `src/app/shared/components/car-card/car-card.component.ts`
- `src/app/core/services/car.service.ts`
- `src/app/core/services/car-finance.service.ts`
- `src/app/core/services/car-document.service.ts`
- `src/app/core/services/driver.service.ts`

**Edge Cases:**
- All three vehicle types (Car, Delivery, Used) share the same `CarDetailsComponent`.
- If no `carId` matches → "not found" template renders.
- File upload in the Add Car modal stores base64 only; no real file persistence.
- Documents tab: "Choose File" button only stores the file NAME (no real upload).

---

### 6.5 Driver Management

**Trigger:** Sidebar → Drivers.

**Steps:**
1. **User selects Drivers from the sidebar** → `DriversComponent` loads.
2. **Application displays the driver list** (default: grid view, 8 seeded drivers).
3. **User switches between grid and list view** via the toggle button.
4. **User opens the Add Driver modal** → fills form (avatar upload, name, email, phone, license, car model, car ref ID, region, CIN) → saves → `DriverService.save()`.
5. **User edits a driver** via the drawer or row action → `DriverService.save()` upserts.
6. **User deletes a driver** → confirmation modal → `TrashService.addItem()` THEN `DriverService.delete()`.
7. **User clicks a driver card** → navigates to `/drivers/:id` (DriverProfileComponent with 4 tabs).

**Files:**
- `src/app/features/drivers/drivers.component.ts`
- `src/app/features/driver-profile/driver-profile.component.ts`
- `src/app/core/services/driver.service.ts`
- `src/app/core/services/trash.service.ts`
- `src/app/core/services/car.service.ts` (for car model dropdown)

**Edge Cases:**
- 10 Tunisian regions hardcoded for the region field.
- Avatar image uses `[src]` with `onAvatarError` fallback to `randomuser.me`.
- Deleting a driver that is assigned to a car does NOT unlink the car automatically.

---

### 6.6 Booking Management

**Trigger:** Sidebar → Booking.

**Steps:**
1. **User selects Booking from the sidebar** → `RequestCarComponent` opens the 4-step wizard.
2. **Application displays Step 1** (Driver Info): name, email, department, phone, hasLicense, hasShellCard, purpose.
3. **User completes Step 1** → advances to Step 2 (Car Type: Delivery Vans / Used Cars).
4. **Application displays the selected category** with availability counts.
5. **User picks a vehicle** in Step 3 (scrollable cards).
6. **User fills Route & Time** in Step 4 (source, destination, departure, arrival).
7. **User submits the booking** → `BookingService.generateRefId()` + `addBooking()`.
8. **Application displays the success receipt** with all entered data, a visual barcode, and a **Print** button that generates a PDF via jsPDF.

**Files:**
- `src/app/features/request-car/request.component.ts`
- `src/app/features/booking-list/booking-list.component.ts`
- `src/app/core/services/booking.service.ts`

**Validation per step:**
- Step 1: name, email, purpose required + must have license.
- Step 2: category must be selected.
- Step 3: vehicle must be selected.
- Step 4: source, destination, departure, arrival required.

**Edge Cases:**
- Booking cannot be edited or deleted from the UI after creation (read-only in Booking List).
- CSV export of Booking List uses BOM prefix for Excel compatibility.

---

### 6.7 Maintenance and Repairs

**Trigger:** Sidebar → Maintenance → Repairs.

**Steps:**
1. **User selects Maintenance from the sidebar** → submenu shows Repairs / Garage CRM.
2. **User opens Repairs** → `RepairsComponent` loads with 2 KPI cards (Still in Maintenance count, Closed count) and 2 tables.
3. **Application displays repairs in two tables:** In Fix (with editable status dropdown) and Closed (with document upload per row).
4. **User changes the repair status** dropdown in the In Fix table (Still in Fix / Fixed / Not Going to Fix Yet) → row state updates.
5. **User opens the Request to Fix modal** → fills car, driver, urgency, reaction type, provider, duration, issue, file attachments → submits.
6. **User uploads a document** per row in the Closed table (file picker, only name stored).
7. **User opens the Closed Ticket modal** to log a finished repair (car, driver, dates, price, provider, description, attachments).

**Files:**
- `src/app/features/repairs/repairs.component.ts`

**Edge Cases:**
- All repairs are stored in a local component array (not a service) — refresh wipes them.
- File uploads in both modals are decorative (filename only).

---

### 6.8 Garage CRM

**Trigger:** Sidebar → Maintenance → Garage CRM.

**Steps:**
1. **User opens Garage CRM** → `GarageCrmComponent` loads with a card grid of 5 seeded providers.
2. **Application displays provider cards** with image, name, service type, location, phone, email, website.
3. **User searches or filters** by service type → `filteredProviders` updates.
4. **User opens the Add Provider modal** → fills 2-column form (name + service type, location, phone, email, website, logo) → saves.
5. **User edits a provider** → modal prefilled → saves.
6. **User deletes a service provider** → confirmation modal → `TrashService.addItem()` THEN delete from local array.

**Files:**
- `src/app/features/garage-crm/garage-crm.component.ts`
- `src/app/core/services/trash.service.ts`

**Edge Cases:**
- Provider storage is in a local component array, not a service.
- Logo upload is base64 only.

---

### 6.9 Reports and Analytics

**Trigger:** Sidebar → Reports.

**Steps:**
1. **User selects Reports from the sidebar** → `ReportsComponent` loads.
2. **Application displays the default tab** (Fleet Overview) with KPI cards, pie chart, line chart, summary table.
3. **User switches between 6 tabs:**
   - Fleet Overview · Vehicle Utilization · Driver Performance · Parking Activity · Maintenance · Fuel Consumption.
4. Each tab renders inline SVG charts (donut, bar, line) with gradient fills.

**Files:**
- `src/app/features/reports/reports.component.ts`

**Edge Cases:**
- All chart data is hardcoded — no real-time data binding.
- No PDF or CSV export on this page.

---

### 6.10 Trash and Recovery

**Trigger:** Sidebar → Trash.

**Steps:**
1. **User selects Trash from the sidebar** → `TrashComponent` loads.
2. **Application displays trashed items** in a table (Type tag, Name, Deleted At, Restore / Permanent Delete buttons).
3. **User restores a deleted item** → `TrashService.restoreItem()` removes from trash and returns the item (caller decides where to re-insert — currently the call sites do NOT re-insert automatically).
4. **User permanently deletes** → `TrashService.permanentDelete()` → item is gone for good.
5. **User clicks "Empty Trash"** → `TrashService.clearAll()` → all items removed.

**Files:**
- `src/app/features/trash/trash.component.ts`
- `src/app/core/services/trash.service.ts`

**Trash is populated by:**
- Document deletion (in CarDetails)
- Driver deletion (in Drivers)
- Provider deletion (in Garage CRM)

**Edge Cases:**
- **Restore does NOT re-create the source entity.** Restoring a driver from trash does not put the driver back into `DriverService`. This is a known bug.
- Trash is in-memory — refresh wipes it.

---

### 6.11 Settings and Preferences

**Trigger:** Sidebar → Settings.

**Steps:**
1. **User selects Settings from the sidebar** → `SettingsComponent` loads.
2. **Application displays settings cards:**
   - General Settings (Language, Time Zone, Date Format)
   - Appearance (Dark / Light toggle)
   - Software & Updates (version `v1.0.0`, Check for Updates, Update Software, Auto Updates)
3. **User changes language, timezone, or date format** → form value updates (no persistence beyond session).
4. **User toggles dark mode** → `ThemeService.toggleTheme()` → `dark` class applied to `<html>` and persisted to `localStorage` (`parkingplus-theme`).
5. **User saves the settings** → visual feedback only (no backend).

**Files:**
- `src/app/features/settings/settings.component.ts`
- `src/app/core/services/theme.service.ts`

**Edge Cases:**
- Language, timezone, and date format selections are NOT persisted.
- "Check for Updates" and "Update Software" buttons have no functionality.

---

### 6.12 User Management

**Trigger:** Sidebar → User Management.

**Steps:**
1. **User selects User Management from the sidebar** → `UserManagementComponent` loads.
2. **Application displays users in a table** (Name, Login, Password, Role badge, Edit / Delete).
3. **User opens the Create User modal** → fills Full Name, Login, Password, Role (admin / user) → saves.
4. **User enters account details** → form validates.
5. **User toggles password visibility** via the eye icon next to the password field.

**Files:**
- `src/app/features/user-management/user-management.component.ts`

**Edge Cases:**
- Users are stored in a local component array.
- "Delete" has no confirmation modal — deletes immediately.
- No password hashing or real authentication.

---

## 7. Cross-Feature Dependencies

```
CarService ────────► Dashboard (vehicle status panel)
                  ├──► Listing (filtered by type)
                  └──► Car Details (via getCarById)
                        ├──► CarFinanceService (9-card grid + edit modal)
                        ├──► CarDocumentService (table + CRUD + trash)
                        └──► DriverService (driver assignment via updateCarDriver)

DriverService ─────► Drivers list + Driver Profile
                  └──► Car Details (assigned driver lookup)

BookingService ────► Booking List (read-only table)
TrashService ◄────── CarDocumentService, DriverService, Garage CRM
ThemeService ◄────── Settings (dark mode)
```

---

## 8. UI / Component Inventory

### Core Layout
- `MainLayoutComponent` — `<nz-layout>` wrapper
- `SidebarComponent` — collapsible navigation (256 px)
- `HeaderComponent` — user avatar + dropdown

### Shared
- `CarCardComponent` — horizontal card with image, driver, name, status badge

### Features
- `LoginComponent` (external template + scss)
- `DashboardComponent`
- `ListingComponent`
- `CarDetailsComponent`
- `DriversComponent`
- `DriverProfileComponent`
- `RequestCarComponent`
- `BookingListComponent`
- `RepairsComponent`
- `GarageCrmComponent`
- `TrashComponent`
- `SettingsComponent`
- `UserManagementComponent`
- `ReportsComponent`

### Modal & Drawer Patterns
- All feature modals use a shared `.modal-overlay` / `.modal-card` CSS pattern with `click.self` to close.
- Driver detail uses a right-side `nz-drawer` for quick view.
- Reports and Dashboard render inline SVG charts (no chart library).

---

## 9. Business Rules & Validations

| Feature | Rule |
|---------|------|
| **Login** | Username alphabet-only; credentials must match `admin/admin`. |
| **Add Car** | `name` must be non-empty. |
| **Booking** | Per-step validation; license required at Step 1. |
| **Delete** | Always routes through `TrashService` first (driver, document, provider). |
| **Trash Restore** | Removes from trash only — does NOT re-insert the entity into its source service. |
| **Theme** | Persisted to `localStorage` under key `parkingplus-theme`. |
| **Driver Assignment** | `CarService.updateCarDriver()` sets both `driverId` and `driver` fields on the car. |
| **Documents** | File name is the only thing stored; the file content is never persisted. |
| **Finance** | Insurance and provider fields are dropdowns from `ASSURANCE_LIST` / `PROVIDER_LIST`. |

---

## 10. Known Limitations & Technical Debt

1. **No backend** — all data resets on page refresh.
2. **Auth guard exists but is not wired** — all protected routes are publicly accessible by URL.
3. **No real file uploads** — only filenames are stored in some flows, base64 in others.
4. **Trash restore is incomplete** — restoring a trashed item does not re-insert it into its source service.
5. **No pagination** — all tables render the full data set.
6. **No error handling for service failures** — synchronous in-memory ops cannot fail.
7. **No loading states** — service methods are sync, so there is nothing to await.
8. **No automated tests** — there are no `.spec.ts` files in the codebase.
9. **PDF generation is client-side only** — `jsPDF` runs in the browser; no server-side persistence.
10. **Reports charts are static** — no data binding to live services.

---

## 11. Appendix: Module → Files Map

| Swim Lane | Primary Files |
|-----------|---------------|
| Authentication and Session | `features/auth/login/`, `core/guards/auth.guard.ts` |
| Navigation and Layout | `core/components/layout/`, `core/components/sidebar/`, `core/components/header/` |
| Dashboard and Fleet Overview | `features/dashboard/` |
| Vehicle Management | `features/listing/`, `features/car-details/`, `shared/components/car-card/`, `core/services/car*.service.ts` |
| Driver Management | `features/drivers/`, `features/driver-profile/`, `core/services/driver.service.ts` |
| Booking Management | `features/request-car/`, `features/booking-list/`, `core/services/booking.service.ts` |
| Maintenance and Repairs | `features/repairs/` |
| Garage CRM | `features/garage-crm/` |
| Reports and Analytics | `features/reports/` |
| Trash and Recovery | `features/trash/`, `core/services/trash.service.ts` |
| Settings and Preferences | `features/settings/`, `core/services/theme.service.ts` |
| User Management | `features/user-management/` |

---

*End of TDD*

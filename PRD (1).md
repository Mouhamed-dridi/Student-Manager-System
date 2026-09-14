Here's the updated PRD outline with a complete **Workflow** section added:

---

## Full PRD Outline

### 1. Product Overview
- Name, tech stack, architecture (standalone Angular, in-memory data), target users

### 2. Application Workflow (NEW)
#### 2.1 Entry & Authentication
- User lands on `/login` → enters `admin/admin` → 600ms simulated auth → redirects to `/dashboard`
- No real session; `localStorage.setItem('isLoggedIn', 'true')` — auth guard exists but is NOT wired

#### 2.2 Navigation Structure
- Main layout: collapsible sidebar (256px) + header (56px) + content area
- **Sidebar tree:**
  - Menu: Dashboard → Vehicles (Cars / Delivery / Used Cars) → Drivers → Booking → Booking List → Maintenance (Repairs / Garage CRM)
  - System: User Management → Reports → Trash → Settings

#### 2.3 Core User Flows

**A) Vehicle Lifecycle**
```
Sidebar → Vehicles → Cars/Delivery/Used Cars (listing page)
  ↓ click card
Car Details (6 tabs: Fiche Technique → Maintenance → Trips → Finance → Documents → Driver)
  ↓ Edit Finance (modal)
  ↓ Documents: Add / Edit / View / Delete (→ Trash)
  ↓ Driver: Assign Driver (dropdown of 8 drivers)
```

**B) Driver Lifecycle**
```
Sidebar → Drivers
  ├── Grid view / List view toggle
  ├── Add Driver (modal form)
  ├── Edit Driver (modal or drawer)
  ├── Delete Driver → TrashService
  └── Click driver → /drivers/:id (Driver Profile, 4 tabs: Overview / Trips / Car Sessions / Contact)
```

**C) Booking Flow**
```
Sidebar → Booking (4-step wizard):
  Step 1: Driver Info (name, email, department, permits)
  Step 2: Car Type (Delivery Vans / Used Cars)
  Step 3: Pick Vehicle (scrollable cards)
  Step 4: Route & Time (source/destination regions, departure/arrival)
  → Submit → BookingService → Success receipt (PDF via jsPDF)
→ Booking List: table of all bookings, CSV export
```

**D) Maintenance Flow**
```
Sidebar → Maintenance → Repairs
  ├── KPI cards (Still in Maintenance count / Closed count)
  ├── In Fix table (status dropdown: Still in Fix / Fixed / Not Going to Fix Yet)
  ├── Closed tickets table (with document upload per row)
  ├── "Request to Fix Car" modal (car, driver, urgency, issue, provider)
  └── "Closed Ticket" modal (car, driver, dates, price, description)
        ↓
Sidebar → Maintenance → Garage CRM (provider card grid)
  ├── Add / Edit provider (modal with logo upload)
  ├── Delete provider → TrashService
  └── Search + service type filter
```

**E) Reporting & System**
```
Sidebar → Reports (6 tabs with inline SVG charts):
  Fleet Overview / Vehicle Utilization / Driver Performance / Parking / Maintenance / Fuel Consumption

Sidebar → Trash (restore or permanent delete any trashed item)
Sidebar → Settings (language, timezone, dark/light theme, version info)
Sidebar → User Management (admin/user accounts, CRUD with password toggle)
```

**F) Cross-Module Data Flow**
```
CarService ──────► Dashboard (KPI counts, vehicle status)
                ├──► Listing (filtered by type)
                └──► Car Details (via getCarById)
                      ├──► CarFinanceService (9-card grid + edit modal)
                      ├──► CarDocumentService (table + add/edit/delete + trash)
                      └──► DriverService (assignment via updateCarDriver)

DriverService ───► Drivers list + Driver Profile
                └──► Car Details (assigned driver lookup)

TrashService ◄─── CarDocumentService (document delete)
                ◄─── DriverService (driver delete)
                ◄─── Garage CRM (provider delete)
```



### 3. Features by Module
Each module documented with: purpose, entities, screens, business rules, edge cases

### 4. Data Models
All interfaces with fields, types, descriptions, and seed data counts

### 5. Business Rules & Logic
- Trash-first deletion pattern
- Finance dropdowns (ASSURANCE_LIST, PROVIDER_LIST)
- Document file name from picker (no real upload)
- Booking wizard validation per step
- Theme persisted to localStorage

### 6. UI Test Scenarios
Per module: exact steps, expected results, what to verify (modals, tables, empty states, error messages)

### 7. Sample Test Cases Table
| # | Module | Precondition | Action | Expected Result | Pass/Fail |

### 8. Known Limitations
- No backend API (all data resets on refresh)
- Login hardcoded `admin/admin`
- Documents are fake (file names only, no real uploads)
- Auth guard exists but not wired to routes
- No pagination on tables

---

Would you like me to create the full PRD file with all of this content?
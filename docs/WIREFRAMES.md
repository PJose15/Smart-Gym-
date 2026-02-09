# SmartGym -- Wireframes

Text-based wireframes for all primary screens in the mobile app and web admin panel.

---

## Table of Contents

1. [Mobile App Screens](#1-mobile-app-screens)
   - [Home](#11-home)
   - [Scan](#12-scan)
   - [Machine Detail](#13-machine-detail)
   - [Profile](#14-profile)
2. [Web Admin Screens](#2-web-admin-screens)
   - [Dashboard](#21-dashboard)
   - [Machines List](#22-machines-list)
   - [Machine Create / Edit](#23-machine-create--edit)
   - [Programs](#24-programs)
   - [Members](#25-members)

---

## 1. Mobile App Screens

Navigation: Bottom tab bar with three tabs -- Home, Scan, Profile.
Machine Detail is a stack screen pushed on top of the tab navigator.

### 1.1 Home

```
+------------------------------------------+
|  [Status Bar]                            |
|  ========================================|
|                                          |
|                                          |
|           Welcome to SmartGym            |
|                                          |
|    Scan a QR code on any machine to      |
|              get started                 |
|                                          |
|        +------------------------+        |
|        |   Scan Machine QR      |        |
|        +------------------------+        |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|==========================================|
|  [ Home ]     [ Scan ]     [ Profile ]   |
+------------------------------------------+
```

**Elements:**
- Centered layout with vertical centering.
- Title: "Welcome to SmartGym" -- 28px bold, dark color (#1a1a2e).
- Subtitle: "Scan a QR code on any machine to get started" -- 16px, secondary gray (#6c757d).
- Primary CTA button: "Scan Machine QR" -- blue (#4361ee), white text, rounded corners.
- Tapping the button navigates to the Scan tab.
- Background: light gray (#f8f9fa).

### 1.2 Scan

```
+------------------------------------------+
|  [Status Bar]                            |
|  ========================================|
|                                          |
|          [Camera Viewfinder]             |
|                                          |
|     +----------------------------+       |
|     |                            |       |
|     |                            |       |
|     |      [ QR Scan Area ]      |       |
|     |       250 x 250 px        |       |
|     |     blue border, rounded   |       |
|     |                            |       |
|     |                            |       |
|     +----------------------------+       |
|                                          |
|       Point at a machine QR code         |
|                                          |
|                                          |
|==========================================|
|  [ Home ]     [ Scan ]     [ Profile ]   |
+------------------------------------------+
```

**States:**

1. **Permission Pending** -- Shows "Requesting camera permission..." centered text.
2. **Permission Denied** -- Shows "Camera access is required to scan QR codes" with a "Grant Permission" button.
3. **Scanning (shown above)** -- Full-screen camera with overlay. Centered scan area (250x250px, blue border, rounded corners). Hint text below.
4. **Error** -- Bottom sheet slides up with error message ("Invalid QR code. Please scan a SmartGym machine QR code.") and a "Scan Again" button.

**Behavior:**
- On successful scan, `parseQrCode()` extracts the slug.
- App navigates to `/machine/<slug>`.
- `scanned` flag prevents duplicate reads until reset.

### 1.3 Machine Detail

```
+------------------------------------------+
|  [< Back]     Machine Details            |
|  ========================================|
|                                          |
|  +--------------------------------------+|
|  |                                      ||
|  |         [Machine Image]              ||
|  |          200px height                ||
|  |                                      ||
|  +--------------------------------------+|
|                                          |
|  Lat Pulldown                            |
|                                          |
|  [Lats] [Biceps] [Rear Delts]           |
|                                          |
|  ── Setup Instructions ──────────────    |
|                                          |
|  (1) Adjust the thigh pad so it sits     |
|      snugly on your thighs              |
|                                          |
|  (2) Select your weight on the stack     |
|                                          |
|  (3) Grip the bar slightly wider than    |
|      shoulder width                      |
|                                          |
|  ── Safety Cues ─────────────────────    |
|                                          |
|  /!\ Do not lean back excessively        |
|                                          |
|  /!\ Control the weight on the way up    |
|                                          |
|==========================================|
|  [ Home ]     [ Scan ]     [ Profile ]   |
+------------------------------------------+
```

**Elements:**
- **Header:** Dark background (#1a1a2e), white text. Back arrow returns to previous screen.
- **Machine image:** Full-width rounded image (200px tall). Shown only if `image_url` is set.
- **Machine name:** 28px bold, dark color.
- **Target muscles:** Horizontal row of blue chips with white text. Wraps if many muscles.
- **Setup instructions:** Section title "Setup Instructions" in 18px bold. Numbered list with blue circle numbers on the left, step text on the right.
- **Safety cues:** Section title "Safety Cues" in 18px bold. Warning icon on the left, cue text on the right.
- **Scroll:** Entire content area is scrollable for machines with long instruction lists.

**Loading state:** Centered spinner with "Loading machine..." text.

**Error state:** Centered warning icon, "Machine Not Found" title, descriptive error text.

### 1.4 Profile

```
+------------------------------------------+
|  [Status Bar]                            |
|  ========================================|
|                                          |
|                                          |
|                                          |
|                                          |
|              Profile                     |
|                                          |
|     Sign in to track your workouts       |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|                                          |
|==========================================|
|  [ Home ]     [ Scan ]     [ Profile ]   |
+------------------------------------------+
```

**Current state (pre-auth):**
- Centered title "Profile" in 24px bold.
- Subtitle "Sign in to track your workouts" in 16px gray.

**Planned authenticated state:**

```
+------------------------------------------+
|  [Status Bar]                            |
|  ========================================|
|                                          |
|         [ Avatar Image ]                 |
|          64x64, circular                 |
|                                          |
|          John Doe                         |
|       john@example.com                   |
|                                          |
|  +--------------------------------------+|
|  |  Total Workouts          12          ||
|  +--------------------------------------+|
|  |  Total Sets              87          ||
|  +--------------------------------------+|
|  |  Points                 142          ||
|  +--------------------------------------+|
|  |  Current Streak      3 weeks         ||
|  +--------------------------------------+|
|                                          |
|  +--------------------------------------+|
|  |          Sign Out                    ||
|  +--------------------------------------+|
|                                          |
|==========================================|
|  [ Home ]     [ Scan ]     [ Profile ]   |
+------------------------------------------+
```

---

## 2. Web Admin Screens

Layout: Fixed sidebar on the left (240px wide, dark background). Main content area on the right with light gray background.

### 2.1 Dashboard

```
+--------+---------------------------------------------+
|        |                                             |
| Smart  |  Dashboard                                  |
| Gym    |  Overview of gym operations, usage           |
|        |  statistics, and key metrics.                |
| Admin  |                                             |
| Panel  |  +----------+ +----------+ +----------+ +--+|
|        |  | TOTAL    | | ACTIVE   | | MEMBERS  | |SE||
|--------|  | MACHINES | | PROGRAMS | |          | |SS||
|        |  |    --    | |    --    | |    --    | |IO||
|  Dash- |  +----------+ +----------+ +----------+ |NS||
|  board |                                         +--+|
|        |                                             |
|  Mach- |                                             |
|  ines  |                                             |
|        |                                             |
|  Pro-  |                                             |
|  grams |                                             |
|        |                                             |
|  Mem-  |                                             |
|  bers  |                                             |
|        |                                             |
+--------+---------------------------------------------+
```

**Elements:**
- **Sidebar:** Dark background (#1a1a2e). Logo "SmartGym" with accent color on "Gym". "Admin Panel" subtitle below. Navigation links: Dashboard, Machines, Programs, Members. Active link has a left blue border and highlighted background.
- **Title:** "Dashboard" in 28px bold.
- **Subtitle:** Descriptive text in gray.
- **Stat cards:** 4 cards in a responsive grid. Each card has: an uppercase label in small gray text, and a large number (32px bold) below. Cards have white background, subtle shadow, rounded corners.
- **Stat values:** Currently placeholder ("--"). Will be populated with real counts from Supabase queries.

### 2.2 Machines List

```
+--------+---------------------------------------------+
|        |                                             |
| Smart  |  Machines                                   |
| Gym    |  Manage gym machines, monitor status,        |
|        |  and configure settings.                     |
| Admin  |                                             |
| Panel  |  [+ Add Machine]                             |
|--------|                                             |
|        |  +------------------------------------------+|
|  Dash- |  | Name        | Muscles   | QR Slug  | Act||
|  board |  |-------------|-----------|----------|----||
|        |  | Lat Pull-   | Lats,     | iron-p.. | Ed ||
|  Mach- >  |  down       |  Biceps   |          | Del||
|  ines  |  |-------------|-----------|----------|----||
|        |  | Bench       | Chest,    | iron-p.. | Ed ||
|  Pro-  |  |  Press      |  Triceps  |          | Del||
|  grams |  |-------------|-----------|----------|----||
|        |  | Cable       | Chest,    | iron-p.. | Ed ||
|  Mem-  |  |  Crossover  |  Delts    |          | Del||
|  bers  |  +------------------------------------------+|
|        |                                             |
+--------+---------------------------------------------+
```

**Elements:**
- **Title and subtitle** matching the pattern from Dashboard.
- **Add Machine button:** Top-right, primary blue, opens the create form.
- **Table columns:** Name, Target Muscles (comma-separated chips), QR Slug (truncated with ellipsis), Actions (Edit, Delete buttons).
- **Empty state:** "Machine list will be displayed here. Connect to Supabase to load data." centered in a white card.

### 2.3 Machine Create / Edit

```
+--------+---------------------------------------------+
|        |                                             |
| Smart  |  [< Back to Machines]                       |
| Gym    |                                             |
|        |  Create Machine  /  Edit Machine             |
| Admin  |                                             |
| Panel  |  +------------------------------------------+|
|--------|  |                                          ||
|        |  |  Machine Name                            ||
|  Dash- |  |  [________________________]              ||
|  board |  |                                          ||
|        |  |  Target Muscles (comma-separated)        ||
|  Mach- |  |  [________________________]              ||
|  ines  |  |                                          ||
|        |  |  Setup Steps (one per line)              ||
|  Pro-  |  |  [________________________]              ||
|  grams |  |  [________________________]              ||
|        |  |  [________________________]              ||
|  Mem-  |  |  [+ Add Step]                            ||
|  bers  |  |                                          ||
|        |  |  Safety Cues (one per line)              ||
|        |  |  [________________________]              ||
|        |  |  [________________________]              ||
|        |  |  [+ Add Cue]                             ||
|        |  |                                          ||
|        |  |  Image URL (optional)                    ||
|        |  |  [________________________]              ||
|        |  |                                          ||
|        |  |  QR Slug (auto-generated)                ||
|        |  |  [iron-paradise-lat-pulldown-a3f9]  (ro) ||
|        |  |                                          ||
|        |  |  +----------+  +----------+              ||
|        |  |  |  Cancel  |  |   Save   |              ||
|        |  |  +----------+  +----------+              ||
|        |  |                                          ||
|        |  +------------------------------------------+|
|        |                                             |
+--------+---------------------------------------------+
```

**Elements:**
- **Back link:** Returns to machines list.
- **Title:** "Create Machine" or "Edit Machine" depending on context.
- **Form fields:**
  - Machine Name: single-line text input (required).
  - Target Muscles: comma-separated text input. Parsed into an array on save.
  - Setup Steps: dynamic list of text inputs. "Add Step" button appends a new row.
  - Safety Cues: dynamic list of text inputs. "Add Cue" button appends a new row.
  - Image URL: single-line text input (optional).
  - QR Slug: read-only field, auto-generated from gym slug + machine name on create. Not editable after creation.
- **Actions:** Cancel returns to list. Save submits to Supabase.

### 2.4 Programs

```
+--------+---------------------------------------------+
|        |                                             |
| Smart  |  Programs                                   |
| Gym    |  Create and manage workout programs,         |
|        |  assign exercises, and set schedules.        |
| Admin  |                                             |
| Panel  |  [+ Create Program]                          |
|--------|                                             |
|        |  +------------------------------------------+|
|  Dash- |  | Beginner Full Body                       ||
|  board |  | 3 days -- Created by Coach Smith          ||
|        |  | [View] [Edit] [Assign to Member]          ||
|  Mach- |  +------------------------------------------+|
|  ines  |  | Intermediate PPL Split                   ||
|        |  | 6 days -- Created by Coach Johnson        ||
|  Pro-  >  | [View] [Edit] [Assign to Member]          ||
|  grams |  +------------------------------------------+|
|        |  | Strength 5x5                             ||
|  Mem-  |  | 3 days -- Created by Owner                ||
|  bers  |  | [View] [Edit] [Assign to Member]          ||
|        |  +------------------------------------------+|
|        |                                             |
+--------+---------------------------------------------+
```

**Program Detail (expanded or separate page):**

```
+--------------------------------------------------+
|                                                  |
|  Beginner Full Body                              |
|  A full body program for new gym members.        |
|                                                  |
|  +----------------------------------------------+|
|  | Day 1 -- Full Body A                          ||
|  |                                              ||
|  |  1. Bench Press (Bench Press Machine)        ||
|  |     3 sets x 10 reps                         ||
|  |                                              ||
|  |  2. Lat Pulldown (Lat Pulldown Machine)      ||
|  |     3 sets x 10 reps                         ||
|  |                                              ||
|  |  3. Leg Press (Leg Press Machine)            ||
|  |     4 sets x 12 reps                         ||
|  +----------------------------------------------+|
|  | Day 2 -- Full Body B                          ||
|  |                                              ||
|  |  1. Overhead Press (free weight)             ||
|  |     3 sets x 10 reps                         ||
|  |                                              ||
|  |  2. Cable Row (Cable Machine)                ||
|  |     3 sets x 12 reps                         ||
|  |                                              ||
|  |  3. Romanian Deadlift (free weight)          ||
|  |     3 sets x 10 reps                         ||
|  +----------------------------------------------+|
|                                                  |
+--------------------------------------------------+
```

**Elements:**
- **Program list:** Card-based layout. Each card shows program name, day count, creator name, and action buttons.
- **Create Program** button opens a form to enter program name, description, and add days with exercises.
- **View** opens the program detail showing all days and exercises.
- **Edit** opens the program in edit mode.
- **Assign to Member** opens a modal to select a member and create a `member_program_assignments` row.
- **Empty state:** "Program list will be displayed here. Connect to Supabase to load data."

### 2.5 Members

```
+--------+---------------------------------------------+
|        |                                             |
| Smart  |  Members                                    |
| Gym    |  View and manage gym members, track          |
|        |  membership status, and review activity.     |
| Admin  |                                             |
| Panel  |  [+ Invite Member]                           |
|--------|                                             |
|        |  +------------------------------------------+|
|  Dash- |  | Name          | Email         | Role    ||
|  board |  |---------------|---------------|---------|
|        |  | John Doe      | john@ex..     | Member  ||
|  Mach- |  |               |               | [Edit]  ||
|  ines  |  |---------------|---------------|---------|
|        |  | Sarah Smith   | sarah@ex..    | Trainer ||
|  Pro-  |  |               |               | [Edit]  ||
|  grams |  |---------------|---------------|---------|
|        |  | Mike Owner    | mike@ex..     | Owner   ||
|  Mem-  >  |               |               | [Edit]  ||
|  bers  |  +------------------------------------------+|
|        |                                             |
|        |  Member Detail (expanded):                  |
|        |  +------------------------------------------+|
|        |  | John Doe                                 ||
|        |  | john@example.com                         ||
|        |  | Role: Member    [Change Role v]          ||
|        |  | Joined: Jan 10, 2025                     ||
|        |  |                                          ||
|        |  | Assigned Programs:                       ||
|        |  |   - Beginner Full Body                   ||
|        |  |                                          ||
|        |  | Recent Workouts:                         ||
|        |  |   - Jan 14: 5 exercises, 18 sets         ||
|        |  |   - Jan 12: 4 exercises, 15 sets         ||
|        |  |                                          ||
|        |  | Points: 142                              ||
|        |  +------------------------------------------+|
|        |                                             |
+--------+---------------------------------------------+
```

**Elements:**
- **Title and subtitle** with consistent styling.
- **Invite Member button:** Opens a form to enter an email address and assign a role. Creates a `gym_members` row (or sends an invite if the profile does not exist yet).
- **Table columns:** Name (from profiles.full_name), Email (truncated), Role (badge-styled).
- **Edit action:** Opens member detail showing assigned programs, recent workout summary, and points balance.
- **Change Role dropdown:** Allows owner to change a member's role between member and trainer. Owner role cannot be reassigned through this UI.
- **Empty state:** "Member list will be displayed here. Connect to Supabase to load data."

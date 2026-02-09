# SmartGym -- Product Requirements Document

**Version:** 0.1.0
**Last updated:** 2025-01-15
**Status:** MVP in development

---

## 1. Product Vision

SmartGym transforms traditional gyms into data-driven, AI-ready environments. By placing a QR code on every piece of equipment, SmartGym creates a seamless bridge between the physical gym floor and a digital experience. Members scan a machine to instantly see setup instructions, safety cues, and target muscles, then log their sets in real time. Gym owners and trainers gain visibility into equipment usage and member progress, laying the foundation for AI-powered coaching, personalized programming, and predictive maintenance.

The long-term ambition is to make every gym -- from a single-location studio to a multi-site franchise -- intelligent. SmartGym is the operating system that makes that possible.

---

## 2. MVP Scope

The minimum viable product delivers three capabilities:

1. **QR Scan to Machine Detail** -- A member walks up to any machine, scans the QR code with the SmartGym mobile app, and immediately sees the machine name, target muscles, setup instructions, and safety cues.

2. **Workout Logging** -- After viewing a machine, the member can log sets (reps, weight, optional RPE) against that machine within an active workout session. The data is persisted in real time.

3. **Multi-Gym Isolation** -- Every resource (machines, programs, members, workouts, points) is scoped to a specific gym. A member who belongs to Gym X cannot see or interact with data from Gym Y. Row-Level Security (RLS) in Supabase enforces this boundary at the database layer.

---

## 3. User Roles

| Role | Description | Permissions |
|-----------|---------------------------------------------------------------------|----------------------------------------------|
| **Owner** | The gym operator who created the gym record. Full administrative control. | Create/edit/delete machines, programs, members. View all workout data and analytics. Manage billing and gym settings. |
| **Trainer** | Staff member responsible for programming and member coaching. | Create/edit machines and programs within their gym. Assign programs to members. View member workout history in their gym. |
| **Member** | An end user who works out at the gym. | Scan QR codes. View machine details for their gym. Log workouts and sets. View their own history and points. |

Role assignment is stored in the `gym_members` table with an enum of `owner | trainer | member`. A single profile can hold different roles at different gyms.

---

## 4. Core Flows

### 4.1 QR Scan Flow

```
Member opens app
  --> Taps "Scan" tab (or "Scan Machine QR" button on Home)
  --> Camera activates with QR viewfinder
  --> Member points at QR code on machine
  --> App reads QR data
  --> parseQrCode() extracts the slug from:
        - smartgym://machine/<slug>   (deep link)
        - https://smartgym.app/m/<slug>  (universal link)
        - plain slug string            (fallback)
  --> App navigates to /machine/<slug>
  --> MachineDetail screen fetches: SELECT * FROM machines WHERE qr_slug = '<slug>'
  --> Screen renders machine name, target muscles, setup steps, safety cues, image
```

### 4.2 Machine Detail View

Once the machine is loaded, the member sees:

- **Header image** (if available) -- a photo of the machine.
- **Machine name** displayed prominently.
- **Target muscles** shown as colored chips (e.g., "Chest", "Triceps").
- **Setup instructions** as a numbered list with step-by-step guidance.
- **Safety cues** as a warning-styled list of things to watch for.
- A **Log Set** action (future) to begin recording exercise data.

### 4.3 Set Logging Flow

```
Member is on MachineDetail screen
  --> Taps "Log Set"
  --> If no active workout exists, one is created:
        INSERT INTO workouts (gym_id, profile_id) VALUES (...)
  --> A workout_exercise row is created (or reused) linking this workout to the machine
  --> Member enters: reps, weight_kg, optional RPE
  --> On confirm: INSERT INTO sets (workout_exercise_id, set_number, reps, weight_kg, rpe)
  --> UI updates to show set count and running totals
  --> Points are credited to points_ledger with reason = 'set_logged'
```

---

## 5. Tech Stack

| Layer | Technology | Details |
|-----------------------|------------------------------|----------------------------------------------|
| **Mobile app** | Expo (React Native) ~52.0 | Expo Router for file-based navigation. expo-camera for QR scanning. expo-secure-store for auth token storage. |
| **Web admin panel** | Next.js 14 (App Router) | Server-side rendering where needed. Shared types and utils via workspace packages. |
| **Backend / Database** | Supabase (PostgreSQL) | Auth (email/password, magic link). Row-Level Security for multi-tenant isolation. Realtime subscriptions (future). Edge Functions (future). |
| **Shared packages** | `@smartgym/types`, `@smartgym/utils` | TypeScript interfaces mirroring every DB table. Utility functions for slug generation, QR parsing, weight formatting. |
| **Monorepo tooling** | pnpm workspaces | Single `pnpm install` at root. Workspace protocol (`workspace:*`) for internal deps. |
| **Code quality** | ESLint + Prettier + TypeScript strict mode | Consistent formatting, no implicit `any`, unused-var warnings. |
| **CI/CD** | EAS Build (Expo Application Services) | Preview builds for internal testing. Production builds for store submission. |

---

## 6. Success Metrics

### 6.1 Adoption

| Metric | Target (3 months post-launch) |
|--------------------------------------|-------------------------------|
| Gyms onboarded | 5 |
| Members per gym (average) | 50 |
| QR scans per member per week | 3+ |
| Workout sessions logged per week | 2+ per active member |

### 6.2 Engagement

| Metric | Target |
|--------------------------------------|-------------------------------|
| Machine detail bounce rate | < 30% |
| Sets logged per workout session | 8+ |
| Return rate (members active 2+ weeks in a row) | > 60% |

### 6.3 Technical

| Metric | Target |
|--------------------------------------|-------------------------------|
| QR scan to machine detail load time | < 2 seconds |
| App crash rate | < 0.5% |
| Supabase query p95 latency | < 200ms |

---

## 7. Future Roadmap

These features are explicitly out of MVP scope but inform architectural decisions made today.

### Phase 2 -- Engagement
- **Leaderboards** -- Gym-scoped leaderboards ranked by points. Weekly and all-time views. Points earned from completing workouts, logging sets, maintaining streaks.
- **Streak tracking** -- Visual streak counter on the Profile screen. Bonus points for consecutive-week activity.
- **Workout history** -- Scrollable timeline of past workouts with exercise summaries and volume charts.

### Phase 3 -- Intelligence
- **AI coaching** -- Natural-language workout suggestions generated from a member's history. "You haven't trained legs in 8 days. Here is a program day you can do today." Powered by Supabase Edge Functions calling an LLM API.
- **Progress analytics** -- Per-exercise strength curves over time. Estimated 1RM tracking. Volume load trends.
- **Smart program generation** -- Trainers describe goals in plain language, and the system generates a structured program with appropriate exercises, sets, and reps.

### Phase 4 -- Operations
- **Equipment maintenance alerts** -- Track usage frequency per machine. Flag machines approaching maintenance thresholds.
- **Occupancy heatmaps** -- Realtime and historical views of which machines and areas are busiest at which times.
- **Multi-gym franchise dashboard** -- Aggregate analytics across all locations for franchise operators.

### Phase 5 -- Platform
- **Third-party integrations** -- Apple Health, Google Fit, Strava sync for cardio machines.
- **Wearable support** -- Apple Watch companion app for hands-free set logging.
- **Public API** -- RESTful API for gym software integrators and third-party developers.

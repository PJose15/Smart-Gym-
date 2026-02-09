# SmartGym -- Release and Setup Guide

Step-by-step instructions for setting up the development environment, running the apps locally, configuring the backend, and building for distribution.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Running Locally](#2-running-locally)
3. [Supabase Setup](#3-supabase-setup)
4. [EAS Build Setup](#4-eas-build-setup)
5. [Deep Linking](#5-deep-linking)
6. [QR Code Generation](#6-qr-code-generation)
7. [Environment Variables Reference](#7-environment-variables-reference)

---

## 1. Prerequisites

Ensure the following tools are installed before proceeding:

| Tool | Minimum Version | Installation |
|-----------------|-----------------|----------------------------------------------|
| **Node.js** | 18.0.0 | https://nodejs.org/ or use `nvm install 18` |
| **pnpm** | 9.0.0 | `npm install -g pnpm@latest` |
| **Expo CLI** | (latest) | `npm install -g expo-cli` |
| **EAS CLI** | 12.0.0 | `npm install -g eas-cli` |
| **Git** | 2.0+ | https://git-scm.com/ |
| **Supabase account** | -- | https://supabase.com/ (free tier works for development) |

**Optional but recommended:**

- **Supabase CLI** -- For local development with `supabase start`. Install: `npm install -g supabase`
- **Android Studio** -- For running Android emulator locally.
- **Xcode** (macOS only) -- For running iOS simulator locally.

---

## 2. Running Locally

### 2.1 Clone and Install

```bash
git clone https://github.com/your-org/Smart-Gym-.git
cd Smart-Gym-
pnpm install
```

`pnpm install` at the root installs dependencies for all workspace packages:
- `apps/mobile`
- `apps/web-admin`
- `packages/types`
- `packages/utils`

### 2.2 Configure Environment Variables

Copy the example env files and fill in your Supabase credentials:

```bash
# Root (used by scripts that reference Supabase directly)
cp .env.example .env

# Mobile app
cp apps/mobile/.env.example apps/mobile/.env

# Web admin
cp apps/web-admin/.env.example apps/web-admin/.env
```

Edit each `.env` file with your Supabase project URL and anon key. See [Section 7](#7-environment-variables-reference) for the full variable list.

### 2.3 Run the Mobile App (Expo)

```bash
pnpm dev:mobile
```

This runs `expo start` in the `apps/mobile` workspace. It opens the Expo Dev Tools in your terminal. From there:

- Press `a` to open on Android emulator.
- Press `i` to open on iOS simulator (macOS only).
- Scan the QR code with the Expo Go app on a physical device.

**Note:** Camera-based QR scanning requires a physical device. The simulator camera cannot scan real QR codes. For development, you can navigate directly to a machine detail screen: open `http://localhost:8081/machine/your-test-slug` in the Expo web view, or use deep linking.

### 2.4 Run the Web Admin (Next.js)

```bash
pnpm dev:web
```

This runs `next dev` in the `apps/web-admin` workspace. The admin panel is available at:

```
http://localhost:3000
```

### 2.5 Run Both Simultaneously

Open two terminal windows:

```bash
# Terminal 1
pnpm dev:mobile

# Terminal 2
pnpm dev:web
```

Or use a process manager like `concurrently` if preferred.

### 2.6 Linting and Type Checking

```bash
# Lint all packages
pnpm lint

# Type-check all packages
pnpm typecheck
```

---

## 3. Supabase Setup

### 3.1 Create a Supabase Project

1. Go to https://supabase.com/dashboard and sign in.
2. Click **New Project**.
3. Enter a project name (e.g., "smartgym-dev").
4. Choose a database password (save it securely).
5. Select a region close to your users.
6. Click **Create new project** and wait for provisioning.

### 3.2 Get Your API Credentials

Once the project is ready:

1. Go to **Settings > API** in the Supabase dashboard.
2. Copy the **Project URL** (e.g., `https://abcdefgh.supabase.co`).
3. Copy the **anon/public** key.
4. Copy the **service_role** key (for server-side operations only -- never expose in client code).
5. Paste these values into your `.env` files.

### 3.3 Run Migrations

The database schema is defined in `supabase/migrations/001_initial_schema.sql`. Apply it using one of these methods:

**Option A: Supabase Dashboard SQL Editor**

1. Go to **SQL Editor** in the Supabase dashboard.
2. Click **New query**.
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`.
4. Click **Run** (or press Ctrl/Cmd + Enter).
5. Verify that all tables appear under **Table Editor**.

**Option B: Supabase CLI (local development)**

```bash
# Link to your remote project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option C: psql (direct connection)**

```bash
psql "postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres" \
  -f supabase/migrations/001_initial_schema.sql
```

### 3.4 Apply RLS Policies

After running the migration, you must enable Row-Level Security and create policies for each table. Run the following SQL in the Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Gyms: members can view their gyms
CREATE POLICY "Members can view their gyms"
  ON gyms FOR SELECT
  USING (id IN (SELECT get_my_gym_ids()));

-- Gym members: users can see memberships in their gyms
CREATE POLICY "Members can view gym memberships"
  ON gym_members FOR SELECT
  USING (gym_id IN (SELECT get_my_gym_ids()));

-- Machines: members can view machines in their gyms
CREATE POLICY "Members can view machines in their gyms"
  ON machines FOR SELECT
  USING (gym_id IN (SELECT get_my_gym_ids()));

-- Machines: only trainers and owners can manage
CREATE POLICY "Trainers and owners can insert machines"
  ON machines FOR INSERT
  WITH CHECK (has_gym_role(gym_id, ARRAY['trainer', 'owner']::user_role[]));

CREATE POLICY "Trainers and owners can update machines"
  ON machines FOR UPDATE
  USING (has_gym_role(gym_id, ARRAY['trainer', 'owner']::user_role[]));

CREATE POLICY "Trainers and owners can delete machines"
  ON machines FOR DELETE
  USING (has_gym_role(gym_id, ARRAY['trainer', 'owner']::user_role[]));

-- Programs: members can view programs in their gyms
CREATE POLICY "Members can view programs"
  ON programs FOR SELECT
  USING (gym_id IN (SELECT get_my_gym_ids()));

CREATE POLICY "Trainers and owners can manage programs"
  ON programs FOR ALL
  USING (has_gym_role(gym_id, ARRAY['trainer', 'owner']::user_role[]));

-- Program days: accessible if parent program is accessible
CREATE POLICY "Members can view program days"
  ON program_days FOR SELECT
  USING (program_id IN (
    SELECT id FROM programs WHERE gym_id IN (SELECT get_my_gym_ids())
  ));

-- Program exercises: accessible if parent day is accessible
CREATE POLICY "Members can view program exercises"
  ON program_exercises FOR SELECT
  USING (program_day_id IN (
    SELECT pd.id FROM program_days pd
    JOIN programs p ON pd.program_id = p.id
    WHERE p.gym_id IN (SELECT get_my_gym_ids())
  ));

-- Workouts: members can view and create their own workouts
CREATE POLICY "Members can view own workouts"
  ON workouts FOR SELECT
  USING (profile_id = auth.uid() AND gym_id IN (SELECT get_my_gym_ids()));

CREATE POLICY "Members can create own workouts"
  ON workouts FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND gym_id IN (SELECT get_my_gym_ids()));

CREATE POLICY "Members can update own workouts"
  ON workouts FOR UPDATE
  USING (profile_id = auth.uid());

-- Workout exercises: linked to own workouts
CREATE POLICY "Members can view own workout exercises"
  ON workout_exercises FOR SELECT
  USING (workout_id IN (
    SELECT id FROM workouts WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Members can insert own workout exercises"
  ON workout_exercises FOR INSERT
  WITH CHECK (workout_id IN (
    SELECT id FROM workouts WHERE profile_id = auth.uid()
  ));

-- Sets: linked to own workout exercises
CREATE POLICY "Members can view own sets"
  ON sets FOR SELECT
  USING (workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON we.workout_id = w.id
    WHERE w.profile_id = auth.uid()
  ));

CREATE POLICY "Members can insert own sets"
  ON sets FOR INSERT
  WITH CHECK (workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON we.workout_id = w.id
    WHERE w.profile_id = auth.uid()
  ));

-- Points ledger: members can view their own points in their gyms
CREATE POLICY "Members can view own points"
  ON points_ledger FOR SELECT
  USING (profile_id = auth.uid() AND gym_id IN (SELECT get_my_gym_ids()));

-- Member program assignments: members can see their own
CREATE POLICY "Members can view own assignments"
  ON member_program_assignments FOR SELECT
  USING (profile_id = auth.uid() AND gym_id IN (SELECT get_my_gym_ids()));

CREATE POLICY "Trainers and owners can manage assignments"
  ON member_program_assignments FOR ALL
  USING (has_gym_role(gym_id, ARRAY['trainer', 'owner']::user_role[]));
```

### 3.5 Run Seed Data

To populate the database with sample data for development, run this SQL in the Supabase SQL Editor:

```sql
-- Insert a sample gym
INSERT INTO gyms (id, name, slug, address) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Iron Paradise', 'iron-paradise', '123 Fitness Ave, Gym City');

-- Insert sample machines
INSERT INTO machines (gym_id, name, qr_slug, target_muscles, setup_steps, safety_cues) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Lat Pulldown',
   'iron-paradise-lat-pulldown-a3f9',
   ARRAY['Lats', 'Biceps', 'Rear Delts'],
   ARRAY['Adjust the thigh pad so it sits snugly on your thighs',
         'Select your weight on the stack',
         'Grip the bar slightly wider than shoulder width'],
   ARRAY['Do not lean back excessively',
         'Control the weight on the way up -- do not let it slam']),
  ('a0000000-0000-0000-0000-000000000001', 'Bench Press Machine',
   'iron-paradise-bench-press-b7c2',
   ARRAY['Chest', 'Triceps', 'Front Delts'],
   ARRAY['Adjust the seat height so the handles align with mid-chest',
         'Select your weight on the stack',
         'Plant feet flat on the floor'],
   ARRAY['Do not lock out elbows completely',
         'Keep shoulder blades retracted throughout']),
  ('a0000000-0000-0000-0000-000000000001', 'Leg Press',
   'iron-paradise-leg-press-d4e1',
   ARRAY['Quadriceps', 'Glutes', 'Hamstrings'],
   ARRAY['Sit with back flat against the pad',
         'Place feet shoulder-width apart on the platform',
         'Release the safety handles before pressing'],
   ARRAY['Do not lock knees at the top',
         'Keep lower back pressed into the seat pad',
         'Do not let knees cave inward']);

-- Note: Profile and gym_member rows require a corresponding auth.users entry.
-- Create test users through the Supabase Auth dashboard or the signup API,
-- then insert their profile and gym_member rows.
```

After creating test users via Supabase Auth, link them:

```sql
-- Replace the UUIDs below with the actual auth.users IDs from your test accounts

-- Create profiles
INSERT INTO profiles (id, email, full_name) VALUES
  ('<owner-user-id>', 'owner@example.com', 'Gym Owner'),
  ('<trainer-user-id>', 'trainer@example.com', 'Coach Smith'),
  ('<member-user-id>', 'member@example.com', 'John Doe');

-- Assign roles
INSERT INTO gym_members (gym_id, profile_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', '<owner-user-id>', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', '<trainer-user-id>', 'trainer'),
  ('a0000000-0000-0000-0000-000000000001', '<member-user-id>', 'member');
```

---

## 4. EAS Build Setup

EAS (Expo Application Services) is used to build the mobile app for distribution.

### 4.1 Install EAS CLI

```bash
npm install -g eas-cli
```

Verify the version is 12.0.0 or higher:

```bash
eas --version
```

### 4.2 Log In to Expo

```bash
eas login
```

Enter your Expo account credentials. If you do not have an account, create one at https://expo.dev/signup.

### 4.3 Configure the Project

The EAS build configuration is already defined in `apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

**Profiles:**

| Profile | Purpose | Distribution |
|---------------|---------------------------------------------|---------------------|
| `development` | Development client with devtools enabled | Internal (team) |
| `preview` | Testing build without devtools, iOS simulator support | Internal (team) |
| `production` | Store-ready build for App Store / Play Store | External (stores) |

### 4.4 Build for Android (Preview)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

Or from the monorepo root:

```bash
pnpm mobile:build:android
```

This uploads the project to EAS servers, compiles an APK (or AAB), and provides a download link when complete. Builds typically take 5-15 minutes.

### 4.5 Build for iOS (Preview)

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

Or from the monorepo root:

```bash
pnpm mobile:build:ios
```

The preview profile builds for the iOS simulator. To build for physical iOS devices, you will need an Apple Developer account and provisioning profiles configured in EAS.

### 4.6 Build for Production

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

Production builds require:
- **Android:** A keystore (EAS can generate one for you on first build).
- **iOS:** An Apple Developer account, app identifier registered in App Store Connect, and provisioning profiles.

### 4.7 Submit to App Stores

```bash
eas submit --platform android
eas submit --platform ios
```

Follow the interactive prompts to configure store credentials and submit the build.

---

## 5. Deep Linking

SmartGym uses the custom URL scheme `smartgym://` for deep linking from QR codes directly into the mobile app.

### 5.1 Scheme Configuration

Defined in `apps/mobile/app.json`:

```json
{
  "expo": {
    "scheme": "smartgym"
  }
}
```

### 5.2 Supported Deep Links

| Pattern | Destination |
|--------------------------------------|------------------------------|
| `smartgym://machine/<qr_slug>` | Machine Detail screen |

### 5.3 How It Works

1. User scans a QR code that encodes `smartgym://machine/iron-paradise-lat-pulldown-a3f9`.
2. The OS recognizes the `smartgym://` scheme and opens the SmartGym app.
3. Expo Router receives the URL and matches it to the `/machine/[slug]` route.
4. The `MachineDetailScreen` component reads `slug` from `useLocalSearchParams()`.
5. The screen fetches the machine from Supabase using the slug.

### 5.4 Universal Links (Future)

To support `https://smartgym.app/m/<slug>` as a universal link:

1. Host an `apple-app-site-association` file at `https://smartgym.app/.well-known/apple-app-site-association`.
2. Host an `assetlinks.json` file at `https://smartgym.app/.well-known/assetlinks.json`.
3. Configure `associatedDomains` in the iOS build and `intentFilters` in the Android build.

This allows the link to open the app when installed, or fall back to a web page when not installed.

---

## 6. QR Code Generation

### 6.1 What to Encode

Every QR code should encode the deep link format:

```
smartgym://machine/<qr_slug>
```

Use the `buildQrValue()` utility to generate the string:

```typescript
import { buildQrValue } from '@smartgym/utils';

const qrContent = buildQrValue('iron-paradise-lat-pulldown-a3f9');
// "smartgym://machine/iron-paradise-lat-pulldown-a3f9"
```

### 6.2 Generating QR Code Images

SmartGym does not currently include a built-in QR code generator. Use any QR code generation tool or library:

**Online tools:**
- https://www.qrcode-monkey.com/ -- Free, customizable QR codes with logo embedding.
- https://goqr.me/ -- Simple and fast.

**Programmatic generation (Node.js):**

```bash
npm install qrcode
```

```typescript
import QRCode from 'qrcode';
import { buildQrValue } from '@smartgym/utils';

const slug = 'iron-paradise-lat-pulldown-a3f9';
const qrContent = buildQrValue(slug);

// Generate as PNG file
await QRCode.toFile(`./qr-${slug}.png`, qrContent, {
  width: 300,
  margin: 2,
  color: {
    dark: '#1a1a2e',
    light: '#ffffff',
  },
});

// Generate as data URL (for embedding in web pages)
const dataUrl = await QRCode.toDataURL(qrContent, { width: 300 });
```

### 6.3 Printing Recommendations

- **Minimum size:** 2 cm x 2 cm (0.8 in x 0.8 in) for reliable scanning at arm's length.
- **Recommended size:** 5 cm x 5 cm (2 in x 2 in) for easy scanning from a comfortable distance.
- **Material:** Use weatherproof, scratch-resistant stickers or labels. Laminated stickers work well in gym environments with sweat and cleaning products.
- **Placement:** Attach to a flat, visible surface on the machine frame. Avoid curved surfaces, moving parts, and areas that get wiped frequently.
- **Contrast:** Ensure high contrast between the QR code and background. Dark code on white background is standard.
- **Testing:** After printing, test every QR code with the SmartGym app before affixing it to the machine.

---

## 7. Environment Variables Reference

### Root `.env`

| Variable | Description | Example |
|---------------------------|--------------------------------------|--------------------------------------|
| `SUPABASE_URL` | Supabase project API URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public API key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | `eyJhbGci...` |

### Mobile App (`apps/mobile/.env`)

| Variable | Description | Example |
|-------------------------------|--------------------------------------|--------------------------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project API URL | `https://abcdefgh.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key | `eyJhbGci...` |

### Web Admin (`apps/web-admin/.env`)

| Variable | Description | Example |
|-------------------------------|--------------------------------------|--------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key | `eyJhbGci...` |

**Security note:** Never commit `.env` files to version control. The `.gitignore` already excludes `.env`, `.env.local`, and `.env.*.local`. The `SUPABASE_SERVICE_ROLE_KEY` should never be used in client-side code -- it bypasses RLS and grants full database access.

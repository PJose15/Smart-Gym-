# SmartGym

SmartGym turns traditional gyms into data-driven, AI-ready environments. Members scan QR codes on gym machines to instantly see setup instructions, target muscles, and safety cues, then log their workouts in real time. Owners and trainers manage equipment and programs through a dedicated web admin panel.

## Tech Stack

- **Mobile App** -- Expo (React Native) with Expo Router, expo-camera for QR scanning
- **Web Admin** -- Next.js 14 (App Router)
- **Backend** -- Supabase (PostgreSQL, Auth, Row-Level Security)
- **Shared Packages** -- `@smartgym/types` (TypeScript interfaces), `@smartgym/utils` (slug generation, QR parsing, formatters)
- **Monorepo** -- pnpm workspaces

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- A Supabase project (free tier works for development)

### Install Dependencies

```bash
pnpm install
```

### Configure Environment Variables

```bash
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web-admin/.env.example apps/web-admin/.env
```

Edit each `.env` file with your Supabase project URL and anon key. See the [Release Guide](docs/RELEASE.md#7-environment-variables-reference) for the full variable list.

### Set Up the Database

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open the SQL Editor and run the contents of `supabase/migrations/001_initial_schema.sql`.
3. Apply the RLS policies from the [Release Guide](docs/RELEASE.md#34-apply-rls-policies).
4. Optionally run the seed data from the [Release Guide](docs/RELEASE.md#35-run-seed-data).

### Run the Mobile App

```bash
pnpm dev:mobile
```

Opens Expo Dev Tools. Press `a` for Android emulator, `i` for iOS simulator, or scan the QR code with Expo Go on a physical device.

### Run the Web Admin

```bash
pnpm dev:web
```

Opens the admin panel at http://localhost:3000.

## Project Structure

```
Smart-Gym-/
  apps/
    mobile/                 # Expo (React Native) mobile app
      app/                  # Expo Router file-based routes
        (tabs)/             # Bottom tab navigator
          index.tsx         # Home screen
          scan.tsx          # QR scanner screen
          profile.tsx       # Profile screen
        machine/
          [slug].tsx        # Machine detail screen (dynamic route)
        _layout.tsx         # Root stack navigator
      src/
        lib/supabase.ts     # Supabase client with SecureStore adapter
        theme/colors.ts     # Design tokens
      app.json              # Expo configuration
      eas.json              # EAS Build configuration
    web-admin/              # Next.js admin panel
      src/
        app/                # Next.js App Router pages
          page.tsx          # Dashboard
          sidebar.tsx       # Navigation sidebar
          layout.tsx        # Root layout
          machines/page.tsx # Machines management
          programs/page.tsx # Programs management
          members/page.tsx  # Members management
        lib/supabase.ts     # Supabase client (browser)
      next.config.js        # Next.js configuration
  packages/
    types/                  # @smartgym/types -- shared TypeScript interfaces
      src/index.ts          # Gym, Profile, Machine, Workout, etc.
    utils/                  # @smartgym/utils -- shared utility functions
      src/index.ts          # generateSlug, generateQrSlug, parseQrCode, etc.
  supabase/
    migrations/
      001_initial_schema.sql  # Database schema (tables, indexes, enums, functions)
  docs/                     # Project documentation
    PRD.md                  # Product Requirements Document
    DATA_MODEL.md           # Database schema and RLS checklist
    API.md                  # API reference and QR code format
    WIREFRAMES.md           # Text-based screen wireframes
    RELEASE.md              # Setup, build, and deployment guide
  package.json              # Root workspace configuration
  pnpm-workspace.yaml       # Workspace package definitions
  tsconfig.base.json        # Shared TypeScript configuration
  .eslintrc.json            # Shared ESLint configuration
  .prettierrc               # Shared Prettier configuration
  .env.example              # Environment variable template
```

## Documentation

| Document | Description |
|----------------------------------------------|----------------------------------------------|
| [Product Requirements](docs/PRD.md) | Vision, MVP scope, user roles, core flows, success metrics, roadmap |
| [Data Model](docs/DATA_MODEL.md) | All database tables, columns, relationships, and RLS verification checklist |
| [API Reference](docs/API.md) | Machine lookup, QR code format, parsing logic, auth flow, future endpoints |
| [Wireframes](docs/WIREFRAMES.md) | Text wireframes for all mobile and web admin screens |
| [Release Guide](docs/RELEASE.md) | Prerequisites, local setup, Supabase config, EAS builds, deep linking |

## Scripts

| Command | Description |
|--------------------------|----------------------------------------------|
| `pnpm install` | Install all dependencies across workspaces |
| `pnpm dev:mobile` | Start the Expo development server |
| `pnpm dev:web` | Start the Next.js development server |
| `pnpm build:web` | Build the Next.js admin panel for production |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking across all packages |
| `pnpm mobile:build:android` | Build Android APK via EAS (preview profile) |
| `pnpm mobile:build:ios` | Build iOS app via EAS (preview profile) |

## License

Private. All rights reserved.

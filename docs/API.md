# SmartGym -- API Reference

**Backend:** Supabase (PostgreSQL + PostgREST + Auth)
**Client libraries:** `@supabase/supabase-js` v2

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Machine Lookup by QR Slug](#2-machine-lookup-by-qr-slug)
3. [QR Code Format Standard](#3-qr-code-format-standard)
4. [QR Parsing Logic](#4-qr-parsing-logic)
5. [Workout and Set Logging](#5-workout-and-set-logging)
6. [Future API Endpoints](#6-future-api-endpoints)

---

## 1. Authentication

SmartGym uses Supabase Auth for all user authentication. The mobile app stores session tokens in `expo-secure-store`. The web admin uses browser cookies via the Supabase client.

### Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'member@example.com',
  password: 'secure-password',
});
// On success, a row is created in auth.users.
// A trigger or client-side call should create a corresponding profiles row.
```

### Sign In (Email / Password)

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'member@example.com',
  password: 'secure-password',
});
// data.session contains access_token and refresh_token.
```

### Sign In (Magic Link)

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: 'member@example.com',
});
// User receives an email with a login link.
```

### Sign Out

```typescript
const { error } = await supabase.auth.signOut();
```

### Session Persistence (Mobile)

The mobile Supabase client is configured with a custom storage adapter that uses `expo-secure-store`:

```typescript
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

This ensures tokens are encrypted at rest on the device and survive app restarts.

### Session Persistence (Web Admin)

The web admin uses the default Supabase browser client, which stores tokens in `localStorage`:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Auth Headers

All Supabase client queries automatically include the `Authorization: Bearer <access_token>` header. RLS policies use `auth.uid()` to identify the current user.

---

## 2. Machine Lookup by QR Slug

The primary data query in the MVP. When a member scans a QR code, the app extracts the slug and fetches the machine.

### Query

```typescript
const { data, error } = await supabase
  .from('machines')
  .select('*')
  .eq('qr_slug', slug)
  .single();
```

### Equivalent SQL

```sql
SELECT * FROM machines WHERE qr_slug = 'iron-paradise-lat-pulldown-a3f9';
```

### Parameters

| Parameter | Type | Description |
|-----------|--------|------------------------------------------|
| slug | string | The `qr_slug` value extracted from the QR code by `parseQrCode()` |

### Response Shape

On success, `data` contains a single `Machine` object:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "gym_id": "660e8400-e29b-41d4-a716-446655440000",
  "name": "Lat Pulldown",
  "qr_slug": "iron-paradise-lat-pulldown-a3f9",
  "target_muscles": ["Lats", "Biceps", "Rear Delts"],
  "setup_steps": [
    "Adjust the thigh pad so it sits snugly on your thighs",
    "Select your weight on the stack",
    "Grip the bar slightly wider than shoulder width"
  ],
  "safety_cues": [
    "Do not lean back excessively",
    "Control the weight on the way up -- do not let it slam"
  ],
  "image_url": "https://storage.example.com/machines/lat-pulldown.jpg",
  "created_at": "2025-01-10T12:00:00Z"
}
```

### Error Cases

| Scenario | Error |
|------------------------------|-------------------------------------------|
| No machine matches the slug | `error.code = 'PGRST116'` (single row not found) |
| User not authenticated | `error.code = '401'` (if RLS requires auth) |
| Network failure | `error.message` describes the connectivity issue |

### RLS Behavior

The machines table RLS policy for SELECT allows a user to read machines that belong to any gym they are a member of. The query uses the globally unique `qr_slug`, so no `gym_id` filter is needed in the client query -- RLS handles scope enforcement.

---

## 3. QR Code Format Standard

Every machine in SmartGym has a physical QR code affixed to it. The QR code encodes a value that the mobile app can parse into a machine slug.

### Supported Formats

SmartGym supports three QR code value formats, in order of preference:

#### 1. Deep Link (Preferred)

```
smartgym://machine/<qr_slug>
```

**Example:** `smartgym://machine/iron-paradise-lat-pulldown-a3f9`

- Uses the app's custom URL scheme (`smartgym://`).
- On iOS and Android, this opens the SmartGym app directly if installed.
- The Expo app configuration declares the `smartgym` scheme in `app.json`.

#### 2. Universal Link (Web Fallback)

```
https://smartgym.app/m/<qr_slug>
```

**Example:** `https://smartgym.app/m/iron-paradise-lat-pulldown-a3f9`

- Works as a regular web URL if the app is not installed.
- The web server at `smartgym.app` can serve a landing page with an "Open in App" prompt.
- When the app is installed and associated with the domain, the OS intercepts the link and opens the app.

#### 3. Plain Slug (Fallback)

```
<qr_slug>
```

**Example:** `iron-paradise-lat-pulldown-a3f9`

- A bare slug string with no protocol or domain.
- Minimum 3 characters, alphanumeric and hyphens only.
- Cannot start or end with a hyphen.
- Used as a last-resort fallback for simple QR generators.

### QR Code Generation

When printing QR codes for machines, encode the deep link format:

```
smartgym://machine/<qr_slug>
```

The `buildQrValue()` utility in `@smartgym/utils` generates this string:

```typescript
import { buildQrValue } from '@smartgym/utils';

const qrContent = buildQrValue('iron-paradise-lat-pulldown-a3f9');
// Returns: "smartgym://machine/iron-paradise-lat-pulldown-a3f9"
```

### QR Slug Generation

When creating a new machine, generate its `qr_slug` using:

```typescript
import { generateQrSlug } from '@smartgym/utils';

const slug = generateQrSlug('iron-paradise', 'Lat Pulldown');
// Returns something like: "iron-paradise-lat-pulldown-a3f9"
```

The function combines the gym slug and machine name into a URL-safe string and appends a random 4-character suffix to ensure uniqueness.

---

## 4. QR Parsing Logic

The `parseQrCode()` function in `@smartgym/utils` handles all three QR formats. It is called immediately after the camera reads a QR code.

### Implementation

```typescript
export function parseQrCode(raw: string): string | null {
  const trimmed = raw.trim();

  // Deep link: smartgym://machine/<slug>
  const deepLinkMatch = trimmed.match(/^smartgym:\/\/machine\/([a-z0-9-]+)$/i);
  if (deepLinkMatch) return deepLinkMatch[1];

  // Universal link: https://*/m/<slug>
  const universalLinkMatch = trimmed.match(/^https?:\/\/[^/]+\/m\/([a-z0-9-]+)$/i);
  if (universalLinkMatch) return universalLinkMatch[1];

  // Plain slug (alphanumeric + hyphens, min 3 chars)
  const plainSlugMatch = trimmed.match(/^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$/i);
  if (plainSlugMatch) return trimmed.toLowerCase();

  return null;
}
```

### Parsing Rules

| Input | Matched Format | Extracted Slug |
|-----------------------------------------------------|----------------|-------------------------------------|
| `smartgym://machine/lat-pulldown-a3f9` | Deep link | `lat-pulldown-a3f9` |
| `https://smartgym.app/m/lat-pulldown-a3f9` | Universal link | `lat-pulldown-a3f9` |
| `http://smartgym.app/m/lat-pulldown-a3f9` | Universal link | `lat-pulldown-a3f9` |
| `https://custom-domain.com/m/lat-pulldown-a3f9` | Universal link | `lat-pulldown-a3f9` |
| `lat-pulldown-a3f9` | Plain slug | `lat-pulldown-a3f9` |
| `ab` | None (too short) | `null` |
| `https://evil.com/phishing` | None | `null` |
| (empty string) | None | `null` |

### Integration in Scan Screen

The scan screen (`apps/mobile/app/(tabs)/scan.tsx`) uses `parseQrCode()` in its barcode handler:

```typescript
const handleBarCodeScanned = ({ data }: { data: string }) => {
  if (scanned) return;
  setScanned(true);

  const slug = parseQrCode(data);
  if (slug) {
    router.push(`/machine/${slug}`);
  } else {
    setError('Invalid QR code. Please scan a SmartGym machine QR code.');
  }
};
```

On a successful parse, the app navigates to the machine detail screen. On failure, the user sees an error message with an option to scan again.

---

## 5. Workout and Set Logging

These queries will power the set logging feature once the UI is built.

### Create a Workout Session

```typescript
const { data: workout, error } = await supabase
  .from('workouts')
  .insert({
    gym_id: machine.gym_id,
    profile_id: currentUser.id,
  })
  .select()
  .single();
```

### Add an Exercise to a Workout

```typescript
const { data: exercise, error } = await supabase
  .from('workout_exercises')
  .insert({
    workout_id: workout.id,
    machine_id: machine.id,
    exercise_name: machine.name,
    order_index: nextIndex,
  })
  .select()
  .single();
```

### Log a Set

```typescript
const { data: set, error } = await supabase
  .from('sets')
  .insert({
    workout_exercise_id: exercise.id,
    set_number: nextSetNumber,
    reps: 10,
    weight_kg: 60.0,
    rpe: 7.5,
  })
  .select()
  .single();
```

### Finish a Workout

```typescript
const { error } = await supabase
  .from('workouts')
  .update({ finished_at: new Date().toISOString() })
  .eq('id', workout.id);
```

### Award Points for a Logged Set

```typescript
const { error } = await supabase
  .from('points_ledger')
  .insert({
    gym_id: workout.gym_id,
    profile_id: currentUser.id,
    points: 1,
    reason: 'set_logged',
    reference_id: set.id,
  });
```

---

## 6. Future API Endpoints

As the product grows beyond direct Supabase client queries, the following endpoints are planned via Supabase Edge Functions or a dedicated API layer.

### Planned Edge Functions

| Function | Method | Path | Description |
|----------------------------|--------|---------------------------------------|----------------------------------------------|
| `complete-workout` | POST | `/functions/v1/complete-workout` | Finalizes a workout, calculates total volume, awards `workout_completed` points, checks for streak bonuses. |
| `assign-program` | POST | `/functions/v1/assign-program` | Assigns a program to a member with validation (trainer/owner role check, gym scope check). Sends a push notification to the member. |
| `leaderboard` | GET | `/functions/v1/leaderboard?gym_id=X` | Returns ranked list of members by total points for a given gym. Supports `period=week` or `period=all`. |
| `ai-suggestion` | POST | `/functions/v1/ai-suggestion` | Accepts a member's recent workout history, calls an LLM, and returns a natural-language workout recommendation. |
| `generate-program` | POST | `/functions/v1/generate-program` | Accepts goals and constraints from a trainer, calls an LLM, and returns a structured program (days, exercises, sets, reps). |
| `export-workout-history` | GET | `/functions/v1/export-history` | Exports a member's workout history as CSV or JSON for a given date range. |

### Planned Realtime Subscriptions

| Channel | Use Case |
|------------------------------|----------------------------------------------|
| `workouts:gym_id=eq.<id>` | Live dashboard showing active workout sessions in a gym. |
| `points_ledger:gym_id=eq.<id>` | Real-time leaderboard updates on a gym TV display. |
| `machines:gym_id=eq.<id>` | Admin panel auto-refreshes when a machine is added or edited by another admin. |

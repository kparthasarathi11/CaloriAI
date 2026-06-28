# CalorAI — Product Requirements Document (PRD)
**Version:** 1.0 · **Author:** Partha Sarathi Komati · **Status:** MVP

---

## 1. Problem Statement

People trying to manage their diet struggle to consistently track what they eat because manual calorie logging is tedious and requires nutritional knowledge most users don't have. Existing apps like MyFitnessPal are powerful but have steep onboarding and paywalled AI features. CalorAI solves this with instant AI-powered meal recognition via a photo, removing the primary friction point of calorie tracking — making users 3× more likely to log consistently.

---

## 2. Goals

| # | Goal | Metric | Target |
|---|------|--------|--------|
| G1 | Users log at least 1 meal per day | DAU meal log rate | ≥ 60% of registered users |
| G2 | AI scan reduces time-to-log vs manual entry | Avg log time | < 15 sec via AI vs ~90 sec manual |
| G3 | Users maintain 7-day streak | Streak retention | 30% of users hit 7-day streak in first month |
| G4 | Core onboarding completion | Funnel completion | ≥ 80% complete goal setup + body stats |
| G5 | Portfolio demo quality | Zero crashes on core flows | Auth, Dashboard, AI Scan, History |

---

## 3. Non-Goals (MVP)

| Non-Goal | Rationale |
|----------|-----------|
| Barcode scanning | Complex library integration; AI text input covers same need |
| Social features (sharing, friends) | Separate initiative; adds scope without core value |
| Exercise / workout tracking | Different product surface; keep focus on diet |
| Premium subscription / payments | Portfolio MVP; monetisation is post-traction |
| Wearable integration (Apple Watch, Fitbit) | API complexity; phase 2 |
| Custom food database / user-submitted foods | Content moderation overhead |

---

## 4. User Personas

### Persona A — The Consistent Tracker (Primary)
- Age 24–35, urban professional, moderately health-conscious
- Has tried calorie apps before, stopped due to friction
- Jobs-to-be-done: Log meals fast without looking up nutritional info

### Persona B — The Goal Setter (Secondary)
- Wants to lose/gain specific weight by a date
- Needs to see progress, not just data
- Jobs-to-be-done: Understand if today's eating is moving toward my goal

---

## 5. User Stories

### Auth
- As a new user, I want to sign up with Google so I don't need to create a new password
- As a returning user, I want to stay logged in across sessions so I don't re-authenticate daily
- As a user, I want a clear error if my login fails so I know what went wrong

### Onboarding
- As a new user, I want to set my goal (lose/maintain/gain) so the app calculates my personal calorie target
- As a new user, I want to enter my age, weight, height so the app uses my BMR for accuracy
- As a user, I want to see my AI-calculated daily target before committing so I can adjust if unrealistic

### Dashboard
- As a daily user, I want to see today's calorie ring at a glance so I know if I'm on track
- As a daily user, I want my streak displayed prominently so I'm motivated to keep logging
- As a user, I want to see macro breakdowns (P/C/F) so I can balance my diet quality

### Meal Logging
- As a user, I want to photograph my meal and get instant calorie estimates so logging takes < 15 seconds
- As a user, I want to type a food description and get AI estimates so I can log without a photo
- As a user, I want to adjust AI-detected portions so the estimate reflects reality
- As a user, I want to tag meals by type (breakfast/lunch/dinner/snack) so I can review my eating patterns
- As a user, I want to delete a logged meal so I can correct mistakes

### Goals
- As a user, I want to set a daily calorie target so the app knows what "on track" means for me
- As a user, I want to set a target weight and date so I can track long-term progress
- As a user, I want to update my goals any time so they reflect life changes

### History
- As a user, I want to see all past days with calorie totals so I can review my eating patterns
- As a user, I want to tap any past day to see the full meal list so I can understand what drove the number
- As a user, I want a weekly trend chart so I can see if I'm improving over time

### Profile
- As a user, I want to update my body stats so recalculation reflects weight changes
- As a user, I want to export my meal history so I can share it with a nutritionist
- As a user, I want to log out securely so my data is protected on shared devices

---

## 6. Functional Requirements

### P0 — Must Have (MVP cannot ship without)

#### AUTH-01: Email/Password Authentication
- **Description:** Users register and log in with email + password via Supabase Auth
- **Acceptance Criteria:**
  - Given a valid email + password, when user submits signup form, then account is created and user is redirected to onboarding
  - Given an existing email, when user tries to sign up again, then error "Account already exists" is shown
  - Given wrong password, when user tries to login, then error "Invalid credentials" is shown (never reveal which field is wrong)
  - Given network failure, when form is submitted, then "Connection error — please try again" is shown
  - Password minimum 8 characters enforced client and server side
  - Email must be valid format before submit is enabled

#### AUTH-02: Google OAuth
- **Description:** One-click sign in with Google via Supabase OAuth
- **Acceptance Criteria:**
  - Given user clicks "Continue with Google", OAuth popup/redirect opens Google consent screen
  - Given user grants consent, account is created/linked and user lands on Dashboard (if existing) or Onboarding (if new)
  - Given user cancels OAuth, they return to login page with no error state
  - Given Google returns an error (invalid_grant, etc.), user sees "Google sign-in failed — try email instead"
  - OAuth state parameter is validated to prevent CSRF

#### AUTH-03: Session Persistence
- **Description:** Users stay logged in across browser refreshes
- **Acceptance Criteria:**
  - Supabase session is stored in localStorage via Supabase client default
  - On app load, if valid session exists, user skips login and goes to Dashboard
  - If session is expired (default 1 hour Supabase token), user is redirected to login with message "Your session expired — please log in again"
  - Logout clears session and redirects to `/login`

#### ONBOARD-01: Goal + Body Stats Setup
- **Description:** 3-step flow for new users: Goal type → Body stats → Calculated target
- **Acceptance Criteria:**
  - New users (no `onboarding_complete` flag in DB) always see onboarding before Dashboard
  - Goal options: Lose weight / Maintain / Gain muscle / Improve fitness
  - Required fields: age (13–100), weight in kg (20–300), height in cm (100–250), activity level (sedentary/lightly active/moderately active/very active)
  - Calorie target calculated using Mifflin-St Jeor BMR formula × activity multiplier × goal adjustment
  - Edge case: if user skips onboarding (back button), they are re-prompted on next login until complete
  - Calculated target stored in `goals` table and displayed to user before confirmation

#### MEAL-01: AI Photo Scan
- **Description:** User uploads/captures meal photo → Gemini Vision returns JSON of food items + calories
- **Acceptance Criteria:**
  - Accepts JPEG, PNG, WEBP; rejects other formats with "Please upload a JPEG or PNG photo"
  - Max file size 10MB; above that shows "Photo too large — try compressing it first"
  - Image sent as base64 to Gemini 1.5 Flash with structured prompt
  - Gemini returns: `{ items: [{name, portion, kcal, protein_g, carbs_g, fat_g}], total_kcal, confidence }`
  - If confidence < 0.5, show banner "Low confidence — please review items carefully"
  - If Gemini returns no recognisable food, show "Couldn't identify food — try manual entry" with manual fallback CTA
  - API timeout: 15 seconds; if exceeded, show "AI took too long — please try again"
  - Rate limit: if GEMINI_API_KEY quota exceeded, show "AI unavailable — use manual entry"
  - User can edit any detected item (name, portion, kcal) before saving
  - User can delete any AI-detected item from the list

#### MEAL-02: Manual Text Entry
- **Description:** User types food name → search in local food DB or uses AI to estimate
- **Acceptance Criteria:**
  - Search field queries a local foods list (seeded in DB or hardcoded) by fuzzy match
  - If no local match found, user can ask AI: "Estimate calories for [typed text]"
  - AI text estimation uses Gemini with prompt: return JSON `{kcal, protein_g, carbs_g, fat_g}` for the described food
  - User selects portion size from dropdown (standard servings) or inputs custom grams
  - Zero-result state shows "No food found — describe it in your own words and let AI estimate"

#### MEAL-03: Meal Log CRUD
- **Description:** Create, read, delete meal log entries per user per day
- **Acceptance Criteria:**
  - Each log entry stores: user_id, food_name, meal_type, kcal, protein_g, carbs_g, fat_g, source (ai_scan/manual/ai_text), logged_at
  - Delete requires confirmation modal "Remove [food name]?" — no undo
  - Edit is not required in MVP (delete + re-add is acceptable)
  - Concurrent logging from two tabs must not duplicate entries (server-side upsert by time window is not needed; last-write-wins is acceptable for MVP)

#### DASH-01: Dashboard
- **Description:** Main home screen showing today's progress
- **Acceptance Criteria:**
  - Calorie ring shows consumed / target with accurate percentage
  - "Remaining" shows target − consumed (green if > 0, red if over)
  - Macros show grams consumed for protein, carbs, fat with progress bars vs target
  - Today's meal list is sorted by logged_at ascending
  - Streak count is accurate — increments only once per calendar day when at least 1 meal is logged
  - Streak resets to 0 if no meals logged on the previous calendar day (not UTC — use user's local timezone)
  - Empty state: "No meals logged yet today — tap + to start"
  - Date shown is in user's local timezone

#### GOALS-01: Goal Management
- **Description:** Users can view and update calorie + macro targets and weight goal
- **Acceptance Criteria:**
  - Calorie target can be manually overridden (range: 800–5000 kcal)
  - Values below 800 are rejected: "Target below 800 kcal may be unsafe — please consult a professional"
  - Macro targets auto-calculate from calorie target (protein 30%, carbs 40%, fat 30% default) but are editable
  - Weight goal: current weight, target weight, target date (must be in the future)
  - Saving goals updates `goals` table and immediately recalculates ring on dashboard

#### HIST-01: History
- **Description:** Paginated list of past days with calorie totals and drill-down
- **Acceptance Criteria:**
  - Shows last 30 days by default; load more for earlier dates
  - Each day shows: date, total kcal, goal status (under/over/no data), number of meals
  - Tapping a day shows full meal list for that day (read-only)
  - Days with no logs show as "Not logged" — not hidden
  - Empty state (brand new user): "Your history will appear here after you log your first meal"

#### PROFILE-01: Profile + Auth
- **Description:** View/edit personal stats; logout
- **Acceptance Criteria:**
  - Displays: name, email, weight, height, age, goal type, BMI (calculated)
  - Name and body stats are editable; email is read-only (auth-level change)
  - Save updates `users` table and triggers goal recalculation
  - Logout calls `supabase.auth.signOut()`, clears state, redirects to `/login`
  - "Delete account" is NOT in MVP scope

---

### P1 — Nice to Have

- **MEAL-P1-01:** Streak freeze (1 per week — miss a day without breaking streak)
- **MEAL-P1-02:** Daily reminder push notification via browser Notification API
- **HIST-P1-01:** Weekly calorie trend chart (recharts bar chart)
- **GOALS-P1-01:** Weight log (daily weigh-in) to track progress toward target weight
- **PROFILE-P1-01:** CSV export of meal history (last 90 days)

### P2 — Future

- Barcode scanning via Quagga.js
- Wearable sync (Apple Health, Google Fit)
- Meal planning / weekly meal prep
- Social streaks / accountability partner
- Premium tier with advanced analytics

---

## 7. API Specifications

### 7.1 Gemini Vision API (Image Scan)

**Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`

**Request:**
```json
{
  "contents": [{
    "parts": [
      {
        "inline_data": {
          "mime_type": "image/jpeg",
          "data": "<base64_string>"
        }
      },
      {
        "text": "You are a nutrition expert. Analyse this meal photo and return ONLY valid JSON with no markdown. Format: {\"items\": [{\"name\": string, \"portion\": string, \"kcal\": number, \"protein_g\": number, \"carbs_g\": number, \"fat_g\": number}], \"total_kcal\": number, \"confidence\": number (0-1)}. If you cannot identify food, return {\"items\": [], \"total_kcal\": 0, \"confidence\": 0}."
      }
    ]
  }],
  "generationConfig": { "temperature": 0.1, "maxOutputTokens": 1024 }
}
```

**Error Handling Matrix:**

| HTTP Status | Error Code | User Message | Action |
|------------|-----------|--------------|--------|
| 400 | INVALID_ARGUMENT | "Photo format not supported" | Show manual entry CTA |
| 429 | RESOURCE_EXHAUSTED | "AI is busy — try again in a moment" | Retry with 3s backoff × 2 |
| 500 | INTERNAL | "AI unavailable — use manual entry" | Fallback to manual |
| Network timeout | — | "Request timed out — check connection" | Show retry button |
| Parse error | — | "Unexpected AI response — log manually" | Log error, show fallback |

**Rate Limits (Gemini Free Tier):**
- 15 RPM (requests per minute)
- 1,500 RPD (requests per day)
- Client-side throttle: disable scan button for 4 seconds after each request

### 7.2 Supabase Auth API

**Endpoints used:**
- `supabase.auth.signUp({ email, password })` — Registration
- `supabase.auth.signInWithPassword({ email, password })` — Login
- `supabase.auth.signInWithOAuth({ provider: 'google' })` — Google OAuth
- `supabase.auth.signOut()` — Logout
- `supabase.auth.getSession()` — Session check on app load
- `supabase.auth.onAuthStateChange()` — Real-time session listener

**Edge Cases:**
- `email_not_confirmed`: "Please check your email to confirm your account"
- `user_already_exists`: "An account with this email already exists — try logging in"
- `invalid_login_credentials`: "Incorrect email or password"
- `signup_disabled`: "Signups are currently disabled" (Supabase project setting)
- OAuth popup blocked by browser: "Popups blocked — allow popups and try again"

### 7.3 Supabase Database API (RLS)

**Row Level Security Policies:**

```sql
-- users table: users can only read/write their own row
CREATE POLICY "Users own their profile" ON users
  FOR ALL USING (auth.uid() = id);

-- meal_logs: users only see their own logs
CREATE POLICY "Users own meal logs" ON meal_logs
  FOR ALL USING (auth.uid() = user_id);

-- goals: users only see their own goals
CREATE POLICY "Users own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- streaks: users only see their own streaks
CREATE POLICY "Users own streaks" ON streaks
  FOR ALL USING (auth.uid() = user_id);
```

---

## 8. Database Schema

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER CHECK (age BETWEEN 13 AND 100),
  weight_kg NUMERIC(5,1) CHECK (weight_kg BETWEEN 20 AND 300),
  height_cm NUMERIC(5,1) CHECK (height_cm BETWEEN 100 AND 250),
  activity_level TEXT CHECK (activity_level IN ('sedentary','lightly_active','moderately_active','very_active')),
  goal_type TEXT CHECK (goal_type IN ('lose_weight','maintain','gain_muscle','improve_fitness')),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calorie_target INTEGER NOT NULL CHECK (calorie_target BETWEEN 800 AND 5000),
  protein_target_g INTEGER,
  carbs_target_g INTEGER,
  fat_target_g INTEGER,
  target_weight_kg NUMERIC(5,1),
  target_date DATE CHECK (target_date > CURRENT_DATE),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal Logs
CREATE TABLE meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  kcal INTEGER NOT NULL CHECK (kcal >= 0),
  protein_g NUMERIC(6,1) DEFAULT 0,
  carbs_g NUMERIC(6,1) DEFAULT 0,
  fat_g NUMERIC(6,1) DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('ai_scan','ai_text','manual')),
  ai_confidence NUMERIC(3,2),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaks
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_logged_date DATE,
  badges JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meal_logs_user_date ON meal_logs (user_id, logged_at DESC);
CREATE INDEX idx_meal_logs_user_today ON meal_logs (user_id, logged_at) 
  WHERE logged_at >= CURRENT_DATE;
```

---

## 9. Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Gemini
VITE_GEMINI_API_KEY=your_gemini_key

# App
VITE_APP_URL=https://calorai.vercel.app
```

> ⚠️ **Security Note:** `VITE_` prefix exposes variables to the browser bundle. The Gemini API key is visible in client-side code. For production, proxy all Gemini calls through a Supabase Edge Function. For portfolio/MVP, direct client-side call is acceptable with free-tier key that has no billing enabled.

---

## 10. Edge Cases Register

| ID | Scenario | Expected Behaviour |
|----|----------|--------------------|
| EC-01 | User logs meal at 11:59 PM then another at 12:01 AM | Second meal goes to next day's log; streak correctly evaluates per calendar day in local TZ |
| EC-02 | Gemini returns malformed JSON | Try `JSON.parse`; if fails, show fallback UI. Never crash. |
| EC-03 | User uploads non-food image (selfie, document) | Gemini returns `confidence: 0`; show "No food detected" with manual fallback |
| EC-04 | User sets calorie target to 799 kcal | Client validation rejects; server CHECK constraint rejects |
| EC-05 | Two browser tabs open, user logs from both simultaneously | Last write wins; refresh resolves conflict |
| EC-06 | User changes timezone mid-day | Streak calculated at save time using `Date` local TZ; historical data unaffected |
| EC-07 | Onboarding: user enters unrealistic stats (age 1, weight 5kg) | DB CHECK constraints reject; form validates ranges client-side first |
| EC-08 | Gemini API key is invalid (403) | Error message: "AI temporarily unavailable — manual logging works fine" |
| EC-09 | User has no meals logged on previous day | Streak resets to 0 when they log today |
| EC-10 | Image upload: HEIC format from iPhone | Reject with "Please convert to JPEG — iOS users: tap 'Share' then 'JPEG'" |
| EC-11 | Supabase project paused (free tier auto-pause after 1 week inactivity) | All API calls fail; show "Service temporarily unavailable" with retry |
| EC-12 | User deletes their Google account | OAuth fails; Supabase session remains valid until expiry |
| EC-13 | Network goes offline mid-upload | fetch rejects; show "No internet connection — your data was not saved" |
| EC-14 | Macro targets don't add up to calorie target | Warn: "Macros don't match calorie target — auto-adjusting protein" |
| EC-15 | History page with 0 logs (brand new user) | Empty state illustration + "Log your first meal to start your history" |

---

## 11. Success Metrics (Post-Launch)

| Metric | Tool | Target | Evaluate At |
|--------|------|--------|-------------|
| Onboarding completion rate | Supabase analytics | ≥ 80% | 2 weeks |
| D7 retention | Supabase user table | ≥ 25% | 1 month |
| AI scan usage rate | `source = 'ai_scan'` query | ≥ 40% of all logs | 2 weeks |
| 7-day streak achievement | Streaks table | ≥ 20% of users | 1 month |
| AI scan error rate | Error logs | < 5% of scan attempts | 1 week |

---

## 12. Deployment Checklist (Vercel)

- [ ] `vercel.json` with SPA rewrite rule (fixes 404 on refresh)
- [ ] All `VITE_` env vars set in Vercel project settings
- [ ] Supabase Google OAuth redirect URL set to `https://your-project.supabase.co/auth/v1/callback`
- [ ] Supabase Site URL set to production Vercel URL
- [ ] RLS enabled on all tables
- [ ] Supabase email confirmations disabled for demo (Settings → Auth → Email)
- [ ] Preview deployments have separate env vars (optional)

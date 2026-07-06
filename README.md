# 🥗 CalorAI — AI Diet & Calorie Tracker

> AI-powered calorie tracking with meal photo analysis · Portfolio project by **Partha Sarathi Komati** · IIM Udaipur

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/calorai)

---

## ✨ Features

| Feature | Tech |
|---------|------|
| 📸 AI Meal Scan | Google Gemini 1.5 Flash Vision |
| 💬 Text-based estimation | Gemini API (free tier) |
| 🔐 Auth (email + Google) | Supabase Auth + Google OAuth |
| 📊 Dashboard with calorie ring | React + Recharts |
| 🔥 Streak tracking | Supabase DB |
| 🎯 Goal management | Mifflin-St Jeor BMR |
| 📅 History with drill-down | Supabase queries |
| 🚀 Deployed | Vercel |

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Database:** Supabase (PostgreSQL with RLS)
- **AI:** Google Gemini 1.5 Flash API (free: 1,500 req/day)
- **Hosting:** Vercel (free tier)

---

## 🚀 Setup Guide

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/calorai.git
cd calorai
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → **New Query**
3. Paste and run the contents of `supabase-schema.sql`
4. Go to **Settings → API** → copy `URL` and `anon public` key

### 3. Enable Google OAuth in Supabase

1. Supabase Dashboard → **Authentication → Providers → Google**
2. Enable Google provider
3. Add your Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
4. Set **Authorized redirect URI** to: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
5. In Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://calorai.vercel.app` (your Vercel URL)
   - Redirect URLs: add `https://calorai.vercel.app/auth/callback`

### 4. Disable Email Confirmation (for demo)

Supabase Dashboard → **Authentication → Settings** → disable "Enable email confirmations"


### 6. Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_APP_URL=http://localhost:5173   # change to Vercel URL after deploy
```



---

## 🌐 Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add all 4 env vars in Vercel project settings
4. Update `VITE_APP_URL` to your Vercel production URL
5. Update Supabase Site URL + Redirect URL to Vercel URL
6. Deploy ✓

The `vercel.json` rewrite rule handles SPA routing (fixes 404 on page refresh).

---

## 📁 Project Structure

```
src/
├── components/
│   ├── layout/        # AppLayout (bottom nav)
│   └── ui/            # Shared components (Ring, Bars, Cards, etc.)
├── hooks/
│   ├── useAuth.jsx    # Auth context + session
│   └── useMeals.js    # Meal CRUD + history
├── lib/
│   ├── supabase.js    # Supabase client
│   ├── gemini.js      # Gemini Vision API client
│   ├── calories.js    # BMR / macro calculations
│   └── streak.js      # Streak logic (timezone-aware)
├── pages/             # One file per screen
└── styles/
    └── globals.css    # Tailwind + PSK brand tokens
```

---

## 🧠 Edge Cases Handled

- **EC-01:** Streak uses local timezone (not UTC) to avoid midnight boundary bugs
- **EC-02:** Gemini JSON parse errors fall back gracefully to manual entry
- **EC-03:** Non-food image → `confidence: 0` → clear error message
- **EC-04:** Calorie target < 800 rejected client + server side
- **EC-07:** Unrealistic body stats rejected by form validation + DB constraints
- **EC-10:** HEIC files rejected with helpful message
- **EC-13:** Network offline handled with user-friendly errors
- **OAuth popup blocked** → clear error prompting user to allow popups

---

## 📄 PRD & Spec

See [SPEC.md](./SPEC.md) for the full Product Requirements Document including:
- User stories · Functional requirements (P0/P1/P2)
- API specification (Gemini + Supabase)
- Database schema with RLS policies
- 15 edge cases register
- Success metrics

---

## 👤 About

**Partha Sarathi Komati** · Product Manager · IIM Udaipur MBA  
[linkedin.com/in/partha-sarathi-komati](https://linkedin.com/in/partha-sarathi-komati)  
*Focus. Build. Impact.*

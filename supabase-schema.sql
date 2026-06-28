-- ============================================================
-- CalorAI — Supabase Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
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

-- ── GOALS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  calorie_target INTEGER NOT NULL CHECK (calorie_target BETWEEN 800 AND 5000),
  protein_target_g INTEGER CHECK (protein_target_g >= 0),
  carbs_target_g INTEGER CHECK (carbs_target_g >= 0),
  fat_target_g INTEGER CHECK (fat_target_g >= 0),
  target_weight_kg NUMERIC(5,1) CHECK (target_weight_kg BETWEEN 20 AND 300),
  target_date DATE CHECK (target_date > CURRENT_DATE),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Only one active goal per user
  CONSTRAINT one_goal_per_user UNIQUE (user_id)
);

-- ── MEAL LOGS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL CHECK (char_length(food_name) BETWEEN 1 AND 200),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  kcal INTEGER NOT NULL CHECK (kcal >= 0 AND kcal <= 10000),
  protein_g NUMERIC(6,1) DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g NUMERIC(6,1) DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g NUMERIC(6,1) DEFAULT 0 CHECK (fat_g >= 0),
  source TEXT NOT NULL CHECK (source IN ('ai_scan','ai_text','manual')),
  ai_confidence NUMERIC(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── STREAKS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0),
  last_logged_date DATE,
  badges JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date 
  ON public.meal_logs (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_day 
  ON public.meal_logs (user_id, DATE(logged_at));

-- ── ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Goals policies
CREATE POLICY "goals_all_own" ON public.goals
  FOR ALL USING (auth.uid() = user_id);

-- Meal logs policies
CREATE POLICY "meal_logs_all_own" ON public.meal_logs
  FOR ALL USING (auth.uid() = user_id);

-- Streaks policies
CREATE POLICY "streaks_all_own" ON public.streaks
  FOR ALL USING (auth.uid() = user_id);

-- ── AUTO-CREATE USER PROFILE ON SIGNUP ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.streaks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── AUTO-UPDATE updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER streaks_updated_at BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

/**
 * CalorAI — Calorie & macro calculation utilities
 * Uses Mifflin-St Jeor BMR formula
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
}

const GOAL_ADJUSTMENTS = {
  lose_weight: -500,   // 500 kcal deficit → ~0.5kg/week loss
  maintain: 0,
  gain_muscle: +300,   // slight surplus
  improve_fitness: 0,
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor
 * @param {{ weight_kg, height_cm, age, sex? }} params
 */
export function calculateBMR({ weight_kg, height_cm, age, sex = 'male' }) {
  // Mifflin-St Jeor (1990) — most accurate for general population
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

/**
 * Calculate daily calorie target
 */
export function calculateCalorieTarget({ weight_kg, height_cm, age, activity_level, goal_type }) {
  const bmr = calculateBMR({ weight_kg, height_cm, age })
  const tdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activity_level] ?? 1.55))
  const adjustment = GOAL_ADJUSTMENTS[goal_type] ?? 0
  const target = Math.max(800, Math.min(5000, tdee + adjustment))
  return target
}

/**
 * Calculate default macro targets from calorie goal
 * Default split: 30% protein, 40% carbs, 30% fat
 */
export function calculateMacros(calorie_target, split = { protein: 0.30, carbs: 0.40, fat: 0.30 }) {
  return {
    protein_target_g: Math.round((calorie_target * split.protein) / 4),  // 4 kcal/g
    carbs_target_g: Math.round((calorie_target * split.carbs) / 4),      // 4 kcal/g
    fat_target_g: Math.round((calorie_target * split.fat) / 9),          // 9 kcal/g
  }
}

/**
 * Calculate BMI
 */
export function calculateBMI(weight_kg, height_cm) {
  if (!weight_kg || !height_cm) return null
  const heightM = height_cm / 100
  return Math.round((weight_kg / (heightM * heightM)) * 10) / 10
}

/**
 * Get BMI category label
 */
export function getBMICategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
  if (bmi < 25)   return { label: 'Normal', color: 'text-green-600' }
  if (bmi < 30)   return { label: 'Overweight', color: 'text-orange-600' }
  return { label: 'Obese', color: 'text-red-600' }
}

/**
 * Validate calorie target (EC-04 in spec)
 */
export function validateCalorieTarget(value) {
  const n = Number(value)
  if (isNaN(n) || n < 800) return 'Target below 800 kcal may be unsafe — please consult a professional'
  if (n > 5000) return 'Target above 5,000 kcal is unusually high — please double-check'
  return null
}

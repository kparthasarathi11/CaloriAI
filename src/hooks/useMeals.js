import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { updateStreak } from '../lib/streak'
import { getLocalDateStr } from '../lib/streak'

export function useMeals(userId) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /** Fetch meals for a given date (defaults to today) */
  const fetchMeals = useCallback(async (dateStr = getLocalDateStr()) => {
    if (!userId) return []
    setLoading(true)
    setError(null)
    try {
      const start = `${dateStr}T00:00:00`
      const end   = `${dateStr}T23:59:59`
      const { data, error: err } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at', { ascending: true })

      if (err) throw err
      return data ?? []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [userId])

  /** Save a new meal entry */
  const addMeal = useCallback(async (mealData) => {
    if (!userId) throw new Error('Not authenticated')
    setLoading(true)
    setError(null)
    try {
      const payload = {
        user_id: userId,
        food_name: mealData.food_name,
        meal_type: mealData.meal_type,
        kcal: Math.round(mealData.kcal),
        protein_g: parseFloat(mealData.protein_g ?? 0),
        carbs_g: parseFloat(mealData.carbs_g ?? 0),
        fat_g: parseFloat(mealData.fat_g ?? 0),
        source: mealData.source, // 'ai_scan' | 'ai_text' | 'manual'
        ai_confidence: mealData.ai_confidence ?? null,
        logged_at: new Date().toISOString(),
      }
      const { data, error: err } = await supabase
        .from('meal_logs')
        .insert(payload)
        .select()
        .single()

      if (err) throw err

      // Update streak after successful log (EC-01: uses local date)
      await updateStreak(userId)

      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  /** Delete a meal entry with confirmation handled by caller */
  const deleteMeal = useCallback(async (mealId) => {
    if (!userId) throw new Error('Not authenticated')
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', mealId)
        .eq('user_id', userId) // extra RLS safety

      if (err) throw err
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  /** Fetch history: last N days summarised */
  const fetchHistory = useCallback(async (days = 30) => {
    if (!userId) return []
    setLoading(true)
    setError(null)
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error: err } = await supabase
        .from('meal_logs')
        .select('logged_at, kcal, protein_g, carbs_g, fat_g, food_name, meal_type, source')
        .eq('user_id', userId)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: false })

      if (err) throw err

      // Group by local date
      const grouped = {}
      for (const log of data ?? []) {
        const dateStr = getLocalDateStr(new Date(log.logged_at))
        if (!grouped[dateStr]) {
          grouped[dateStr] = { date: dateStr, kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0, meals: [] }
        }
        grouped[dateStr].kcal    += log.kcal
        grouped[dateStr].protein += parseFloat(log.protein_g)
        grouped[dateStr].carbs   += parseFloat(log.carbs_g)
        grouped[dateStr].fat     += parseFloat(log.fat_g)
        grouped[dateStr].count   += 1
        grouped[dateStr].meals.push(log)
      }

      return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date))
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [userId])

  return { fetchMeals, addMeal, deleteMeal, fetchHistory, loading, error }
}

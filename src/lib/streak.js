import { format, parseISO, isYesterday, isToday } from 'date-fns'
import { supabase } from './supabase'

/**
 * Get today's date string in local timezone (YYYY-MM-DD)
 * Edge case EC-01: use local date, not UTC, to avoid midnight boundary issues
 */
export function getLocalDateStr(date = new Date()) {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Update the streak for the current user after logging a meal.
 * Called client-side after each successful meal save.
 * @param {string} userId
 */
export async function updateStreak(userId) {
  const today = getLocalDateStr()

  // Get current streak record
  const { data: streak, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Streak fetch error:', error)
    return
  }

  const lastDate = streak?.last_logged_date // 'YYYY-MM-DD' string or null
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0

  let newStreak = currentStreak

  if (lastDate === today) {
    // Already logged today — no change needed
    return
  }

  if (lastDate) {
    const lastDateObj = parseISO(lastDate)
    if (isYesterday(lastDateObj)) {
      // Consecutive day — extend streak
      newStreak = currentStreak + 1
    } else {
      // Gap of 2+ days — reset (EC-09)
      newStreak = 1
    }
  } else {
    // First ever log
    newStreak = 1
  }

  const newLongest = Math.max(longestStreak, newStreak)

  // Update badges
  const badges = streak?.badges ?? []
  const newBadges = [...badges]
  const BADGE_THRESHOLDS = [3, 7, 14, 30, 60, 100]
  for (const threshold of BADGE_THRESHOLDS) {
    const badgeId = `streak_${threshold}`
    if (newStreak >= threshold && !newBadges.some(b => b.id === badgeId)) {
      newBadges.push({ id: badgeId, earned_at: new Date().toISOString() })
    }
  }

  await supabase.from('streaks').upsert({
    user_id: userId,
    current_streak: newStreak,
    longest_streak: newLongest,
    last_logged_date: today,
    badges: newBadges,
    updated_at: new Date().toISOString(),
  })
}

/**
 * Get the streak display dots for the last 7 days
 */
export function getWeekDots(lastLoggedDate, currentStreak) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = new Date()
  const todayDay = today.getDay() // 0=Sun..6=Sat
  // Map to Mon-start week
  const mondayStart = ((todayDay + 6) % 7)

  return days.map((label, i) => {
    const daysAgo = mondayStart - i
    let status = 'miss'
    if (daysAgo === 0) status = 'today'
    else if (daysAgo > 0 && daysAgo <= currentStreak) status = 'done'
    return { label, status }
  })
}

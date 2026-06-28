import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'

/**
 * Handles the OAuth redirect from Google/Supabase.
 * Supabase client auto-parses the hash/query params and sets the session.
 * We just wait for the auth state change and redirect.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // The Supabase client with detectSessionInUrl:true handles this automatically.
    // We listen for the session change and then decide where to send the user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user has completed onboarding
        const { data: profile } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', session.user.id)
          .single()

        if (!profile?.onboarding_complete) {
          navigate('/onboarding', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } else if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true })
      }
    })

    // Fallback: if no event fires in 5s, redirect to home (auth state may already be set)
    const fallback = setTimeout(() => navigate('/', { replace: true }), 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallback)
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-16 h-16 rounded-2xl grad flex items-center justify-center">
        <span className="text-2xl">🥗</span>
      </div>
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">Signing you in…</p>
    </div>
  )
}

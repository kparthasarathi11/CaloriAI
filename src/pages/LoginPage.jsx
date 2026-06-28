import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Alert, Spinner } from '../components/ui'

const ERROR_MAP = {
  'Invalid login credentials': 'Incorrect email or password.',
  'Email not confirmed':       'Please check your email to confirm your account.',
  'User not found':            'No account found with this email.',
}

function mapError(msg) {
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (msg?.includes(key)) return val
  }
  return msg || 'Something went wrong — please try again.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      navigate('/')
    } catch (err) {
      setError(mapError(err.message))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setOauthLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
        },
      })
      if (err) throw err
      // Redirect happens automatically
    } catch (err) {
      // EC: popup blocked or OAuth error
      if (err.message?.includes('popup')) {
        setError('Popups were blocked — allow popups for this site and try again.')
      } else {
        setError('Google sign-in failed — try email instead.')
      }
      setOauthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🥗</div>
        <h1 className="text-2xl font-black text-slate-800">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-1">Log in to CalorAI</p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogle}
        disabled={oauthLoading || loading}
        className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition mb-4 disabled:opacity-50"
      >
        {oauthLoading ? <Spinner size="sm" /> : (
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
        )}
        Continue with Google
      </button>

      <div className="flex items-center gap-3 w-full mb-4">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">or email</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Email form */}
      <form onSubmit={handleLogin} className="w-full space-y-3">
        {error && <Alert type="error">{error}</Alert>}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="current-password"
            disabled={loading}
          />
          <div className="text-right mt-1">
            <button type="button" className="text-xs text-blue-600 font-semibold">
              Forgot password?
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading || oauthLoading} className="btn-primary">
          {loading ? <Spinner size="sm" className="mx-auto" /> : 'Log In'}
        </button>
      </form>

      <p className="text-sm text-slate-500 mt-6">
        No account?{' '}
        <Link to="/signup" className="text-blue-600 font-semibold">Sign up free</Link>
      </p>

      {/* PSK footer */}
      <p className="text-[10px] text-slate-400 mt-8">
        Built by <span className="font-bold text-blue-500">Partha Sarathi Komati</span> · IIM Udaipur
      </p>
    </div>
  )
}

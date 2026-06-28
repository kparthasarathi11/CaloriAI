import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

// Pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import LogMealPage from './pages/LogMealPage'
import AIScanPage from './pages/AIScanPage'
import GoalsPage from './pages/GoalsPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import AuthCallbackPage from './pages/AuthCallbackPage'

function AppRoutes() {
  const { loading, isAuthenticated, needsOnboarding } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl grad flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl">🥗</span>
          </div>
          <p className="text-sm text-slate-500 animate-pulse">Loading CalorAI…</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={!isAuthenticated ? <LoginPage />  : <Navigate to="/" replace />} />
      <Route path="/signup"   element={!isAuthenticated ? <SignupPage /> : <Navigate to="/" replace />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected routes */}
      <Route path="/onboarding" element={
        isAuthenticated ? <OnboardingPage /> : <Navigate to="/login" replace />
      } />
      <Route path="/" element={
        !isAuthenticated   ? <Navigate to="/login" replace />
        : needsOnboarding  ? <Navigate to="/onboarding" replace />
        : <DashboardPage />
      } />
      <Route path="/log"     element={isAuthenticated ? <LogMealPage />  : <Navigate to="/login" replace />} />
      <Route path="/scan"    element={isAuthenticated ? <AIScanPage />   : <Navigate to="/login" replace />} />
      <Route path="/goals"   element={isAuthenticated ? <GoalsPage />    : <Navigate to="/login" replace />} />
      <Route path="/history" element={isAuthenticated ? <HistoryPage />  : <Navigate to="/login" replace />} />
      <Route path="/profile" element={isAuthenticated ? <ProfilePage />  : <Navigate to="/login" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

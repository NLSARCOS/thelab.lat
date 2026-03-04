import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage.tsx'
import Login from './pages/Login.tsx'
import Signup from './pages/Signup.tsx'
import ShieldOnboarding from './pages/ShieldOnboarding.tsx'
import Dashboard from './pages/Dashboard.tsx'
import AdminDashboard from './pages/AdminDashboard.tsx'
import Pricing from './pages/Pricing.tsx'
import ScanReport from './pages/ScanReport.tsx'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('vb_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('vb_token');
  const user = JSON.parse(localStorage.getItem('vb_user') || '{}');
  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/shield-onboarding" element={<ShieldOnboarding />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/scan/:id" element={<ProtectedRoute><ScanReport /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

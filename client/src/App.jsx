import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import { ThemeProvider } from "@/context/ThemeContext"
import AppToaster from "@/components/AppToaster"
import ProtectedRoute from "@/components/ProtectedRoute"
import Layout from "@/components/Layout"
import LoginPage from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import ProductsPage from "@/pages/ProductsPage"
import NotificationsPage from "@/pages/NotificationsPage"
import RecipientsPage from "@/pages/RecipientsPage"
import useDesktopOnly from "@/hooks/useDesktopOnly"

export default function App() {
  const isBlocked = useDesktopOnly()
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">Desktop Only</h1>
          <p className="text-muted-foreground">
            This application is not available on mobile or tablet devices.
          </p>
        </div>
      </div>
    )
  }
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppToaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="recipients" element={<RecipientsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

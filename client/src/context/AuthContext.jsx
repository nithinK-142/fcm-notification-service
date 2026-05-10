import api from "@/lib/api"
import { jwtDecode } from "jwt-decode"
import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      try {
        const decoded = jwtDecode(token)
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          localStorage.removeItem("token")
        } else {
          setUser(decoded)
        }
      } catch {
        localStorage.removeItem("token")
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password })
    const { token } = res.data
    localStorage.setItem("token", token)
    const decoded = jwtDecode(token)
    setUser(decoded)
    return decoded
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}

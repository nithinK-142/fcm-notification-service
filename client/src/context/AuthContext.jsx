import api from "@/lib/api"
import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const savedUser = localStorage.getItem("user")
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password })
    const { token, user } = res.data
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    setUser(user)
    return user
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
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

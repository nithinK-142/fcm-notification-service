import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("token")
    const savedUser = localStorage.getItem("user")
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await axios.post("/api/auth/login", { email, password })
    const { token, user } = res.data
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
    setUser(user)
    return user
  }

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    delete axios.defaults.headers.common["Authorization"]
    setUser(null)
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

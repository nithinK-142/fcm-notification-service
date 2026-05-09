import { Xior } from "xior"

const api = Xior.create({ baseURL: `${import.meta.env.VITE_API_URL}/api`, credentials: "include" })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

// Products
export const getProducts = (body) => api.post("/products", body)

// Notifications
export const getNotifications = (params) => api.get("/notifications", { params })
export const createNotification = (data) => api.post("/notifications", data)
export const updateNotification = (id, data) => api.put(`/notifications/${id}`, data)
export const deleteNotification = (id) => api.delete(`/notifications/${id}`)
export const sendNotification = (id) => api.post(`/notifications/${id}/send`)

// Dashboard
export const getDashboardStats = () => api.get("/dashboard/stats")

// Auth
export const loginUser = (email, password) => api.post("/auth/login", { email, password })

export default api

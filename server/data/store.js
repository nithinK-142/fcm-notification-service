const { v7: uuid } = require("uuid");

const users = [
  {
    id: uuid(),
    name: "Admin User",
    email: "admin@dealsdray.com",
    passwordHash: "$2b$10$RaZsWnZWN8eBKdp6T3q12.wVCAu8w.PNy..l7OFQu0ddASZIZBa5O",    // bcrypt hash of "admin123"
    role: "admin",
  },
]

const products = [
  { id: uuid(), name: "Samsung Galaxy S24", category: "Electronics", price: 74999, status: "active", imageUrl: "", description: "Latest Samsung flagship", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: uuid(), name: "Nike Air Max 270", category: "Fashion", price: 12995, status: "active", imageUrl: "", description: "Premium running shoes", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: uuid(), name: "Organic Basmati Rice 5kg", category: "Grocery", price: 599, status: "active", imageUrl: "", description: "Premium quality rice", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: uuid(), name: "Dyson V12 Vacuum", category: "Home", price: 44900, status: "inactive", imageUrl: "", description: "Cordless vacuum cleaner", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: uuid(), name: "Mamaearth Face Wash", category: "Beauty", price: 299, status: "active", imageUrl: "", description: "Natural ingredients", createdAt: new Date(Date.now() - 86400000).toISOString() },
]

const notifications = [
  { id: uuid(), title: "🔥 Flash Sale — Up to 70% Off!", body: "Shop the biggest sale of the year. Limited time only!", type: "promotional", status: "sent", targetUrl: "https://dealsdray.com/sale", imageUrl: "", scheduledAt: null, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: uuid(), title: "Your order has been shipped 📦", body: "Your order #DD12345 is on its way. Track it now.", type: "transactional", status: "sent", targetUrl: "https://dealsdray.com/orders", imageUrl: "", scheduledAt: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: uuid(), title: "Don't forget! Items in your cart 🛒", body: "You left something behind. Complete your purchase today.", type: "reminder", status: "scheduled", targetUrl: "https://dealsdray.com/cart", imageUrl: "", scheduledAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: uuid(), title: "Weekend Grocery Deals 🥦", body: "Fresh produce at unbeatable prices. Valid this weekend only.", type: "promotional", status: "draft", targetUrl: "https://dealsdray.com/grocery", imageUrl: "", scheduledAt: null, createdAt: new Date().toISOString() },
]

module.exports = { users, products, notifications };

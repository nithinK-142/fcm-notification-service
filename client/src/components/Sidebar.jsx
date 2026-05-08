import { NavLink, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { cn } from "@/lib/utils"
import { Bell, LayoutDashboard, Package, LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/notifications", label: "Notifications", icon: Bell },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true"
  })

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", collapsed)
  }, [collapsed])

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-card border-r h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      {/* Brand + toggle */}
      <div className={cn("flex items-center h-[60px] px-4 gap-3", collapsed && "justify-center px-0")}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/30 shrink-0">
          <Bell className="w-4 h-4 text-primary-foreground" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm leading-tight">DealsDray</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Push Console</p>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setCollapsed(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      <Separator />

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-3">Menu</p>
        )}
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                collapsed && "justify-center px-0 py-2.5 w-10 mx-auto",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* User + theme */}
      <div className={cn("px-2 py-4", collapsed && "flex flex-col items-center gap-2")}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-secondary/60">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "A"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
              <button
                onClick={toggleTheme}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center"
              title={user?.name || "Admin"}
            >
              <span className="text-xs font-bold text-primary">
                {user?.name?.charAt(0)?.toUpperCase() || "A"}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              title={dark ? "Light mode" : "Dark mode"}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

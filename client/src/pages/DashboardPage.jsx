import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getDashboardStats } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Bell, TrendingUp, Send, ArrowRight, Loader2 } from "lucide-react"

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, to, trend }) {
  return (
    <Link to={to} className="group block">
      <Card className="hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className="font-display text-4xl font-bold mt-1 text-foreground">{value ?? "—"}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
              )}
              {trend !== undefined && (
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">{trend}</span>
                </div>
              )}
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} shrink-0`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your B2R push notification platform
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <StatCard
          title="Total Products"
          value={stats?.totalProducts}
          subtitle="Registered in catalog"
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          to="/products"
          trend={`${stats?.activeProducts ?? 0} active`}
        />
        <StatCard
          title="Notifications"
          value={stats?.totalNotifications}
          subtitle="Created campaigns"
          icon={Bell}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          to="/notifications"
          trend={`${stats?.sentNotifications ?? 0} sent`}
        />
      </div>

      {/* Recent notifications */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground">Recent Notifications</h2>
          <Link to="/notifications" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {stats?.recentNotifications?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y">
                {stats?.recentNotifications?.map((n) => (
                  <div key={n.id} className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      {n.status === "sent" ? (
                        <Send className="w-4 h-4 text-violet-600" />
                      ) : (
                        <Bell className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={
                        n.status === "sent" ? "success" :
                        n.status === "scheduled" ? "warning" : "secondary"
                      }>
                        {n.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground">Recent Products</h2>
          <Link to="/products" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {stats?.recentProducts?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No products yet
              </div>
            ) : (
              <div className="divide-y">
                {stats?.recentProducts?.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.category}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={p.status === "active" ? "success" : "secondary"}>
                        {p.status}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        ₹{p.price?.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

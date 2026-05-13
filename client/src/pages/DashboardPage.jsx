import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getDashboardStats } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skel } from "@/components/ui/skeletons"
import { Package, Bell, Users, TrendingUp, Send, ArrowRight } from "lucide-react"

function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, to, trend }) {
  return (
    <Link to={to} className="group block">
      <Card className="hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className="text-4xl font-bold mt-1 tabular-nums">
                {value ?? <span className="text-muted-foreground/40">—</span>}
              </p>
              {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
              {trend && (
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

function SectionHeader({ title, to }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <Link to={to} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
        View all <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
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
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your B2R push notification platform</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Notifications</p>
                  <Skel className="h-9 w-16 mt-1" />
                  <p className="text-xs text-muted-foreground mt-1.5">Created campaigns</p>
                  <Skel className="h-3 w-20 mt-2" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center shrink-0">
                  <Bell className="w-6 h-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Products</p>
                  <Skel className="h-9 w-16 mt-1" />
                  <p className="text-xs text-muted-foreground mt-1.5">Registered in catalog</p>
                  <Skel className="h-3 w-28 mt-2" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Recipients</p>
                  <Skel className="h-9 w-16 mt-1" />
                  <p className="text-xs text-muted-foreground mt-1.5">Registered FCM tokens</p>
                  <Skel className="h-3 w-28 mt-2" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Notifications</h2>
            <span className="text-xs text-primary font-medium">View all</span>
          </div>
          <Card>
            <CardContent className="p-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
                  <Skel className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skel className="h-4 w-40" />
                    <Skel className="h-3 w-56" />
                  </div>
                  <Skel className="h-5 w-16 rounded-full shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Products</h2>
            <span className="text-xs text-primary font-medium">View all</span>
          </div>
          <Card>
            <CardContent className="p-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
                  <Skel className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skel className="h-4 w-44" />
                    <Skel className="h-3 w-32" />
                  </div>
                  <Skel className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your B2R push notification platform</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <StatCard
          title="Notifications"
          value={stats?.totalNotifications?.toLocaleString()}
          subtitle="Created campaigns"
          icon={Bell}
          iconColor="text-violet-600"
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          to="/notifications"
          trend={`${stats?.sentNotifications?.toLocaleString() ?? 0} done`}
        />
        <StatCard
          title="Total Products"
          value={stats?.totalProducts?.toLocaleString()}
          subtitle="Registered in catalog"
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          to="/products"
          trend={`${stats?.activeProducts?.toLocaleString() ?? 0} active with stock`}
        />
        {stats?.totalRecipients != null && (
          <StatCard
            title="Recipients"
            value={stats?.totalRecipients?.toLocaleString()}
            subtitle="Registered FCM tokens"
            icon={Users}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
            to="/recipients"
            trend={`${stats?.updatedToday?.toLocaleString() ?? 0} updated today`}
          />
        )}
      </div>

      {/* Recent notifications */}
      <div className="mb-8">
        <SectionHeader title="Recent Notifications" to="/notifications" />
        <Card>
          <CardContent className="p-0">
            {!stats?.recentNotifications?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No notifications yet</div>
            ) : (
              <div className="divide-y">
                {stats.recentNotifications.map((n) => (
                  <div key={n.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                      {n.imageUrl
                        ? <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                        : <Bell className="w-4 h-4 text-violet-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={
                        n.status === "done" ? "success" :
                          n.status === "processing" ? "warning" :
                            n.status === "server_error" ? "destructive" : "secondary"
                      }>
                        {n.status}
                      </Badge>
                      {n.sentCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Send className="w-3 h-3" /> {n.sentCount}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString("en-IN")}
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
        <SectionHeader title="Recent Products" to="/products" />
        <Card>
          <CardContent className="p-0">
            {!stats?.recentProducts?.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No products yet</div>
            ) : (
              <div className="divide-y">
                {stats.recentProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 shrink-0 overflow-hidden flex items-center justify-center">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <Package className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.brand} · {p.grade} Grade</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
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

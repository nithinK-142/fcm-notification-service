import { useEffect, useState } from "react"
import { getRecipients } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, RefreshCw, Users, MapPin, Tag, RefreshCcw } from "lucide-react"
import { cn, formatStateName } from "@/lib/utils"

function StatCard({ title, count, subtitle, dim }) {
  return (
    <Card className={cn("border transition-all hover:shadow-md hover:border-primary/20")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate mb-1">{title}</p>
            <p className="text-2xl font-bold tabular-nums opacity-85">{count.toLocaleString()}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{subtitle}</p>
            )}
          </div>
          <div className="w-1 self-stretch rounded-full bg-muted overflow-hidden shrink-0">
            <div className="w-full rounded-full bg-primary/60 transition-all duration-500" style={{ height: `${dim}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{count} {count === 1 ? "entry" : "entries"}</p>
      </div>
    </div>
  )
}

function Skel({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {[...Array(count)].map((_, i) => <Skel key={i} className="h-24" />)}
    </div>
  )
}

export default function RecipientsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getRecipients()
      setData(res.data)
    } catch (e) {
      console.error(e)
      setError("Failed to load recipients")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const states = data?.recipientsByState ?? []
  const categories = data ? Object.entries(data.recipientsByRegCategory) : []
  const maxState = states[0]?.count ?? 1

  return (
    <div className="p-8 max-w-[1400px] mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Recipients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            FCM token registry — synced from local MongoDB every 30 min
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 border">
            <Users className="w-4 h-4 text-muted-foreground" />
            {loading
              ? <Skel className="h-5 w-16" />
              : <span className="text-sm font-semibold tabular-nums">{data?.totalRecipients?.toLocaleString() ?? "—"}</span>
            }
            <span className="text-xs text-muted-foreground">total</span>
          </div>

          {/* Sync now — wired up later */}
          <Button variant="outline" className="gap-2" disabled>
            <RefreshCcw className="w-4 h-4" />
            Sync Now
          </Button>

          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-10">
        <SectionHeader
          icon={Tag}
          title="By Registration Category"
          count={categories.length}
        />
        {loading ? (
          <SkeletonGrid count={3} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map(([id, { count, categoryTitle }]) => (
              <StatCard key={id} title={categoryTitle} count={count} subtitle="registered" dim={Math.round((count / (data?.totalRecipients || 1)) * 100)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader
          icon={MapPin}
          title="By State / UT"
          count={states.length}
        />
        {loading ? (
          <SkeletonGrid count={18} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {states.map(({ state, count }) => (
              <StatCard key={state} title={formatStateName(state)} count={count} dim={Math.round((count / maxState) * 100)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
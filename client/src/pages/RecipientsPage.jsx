import { useEffect, useState } from "react"
import { getRecipients } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skel, SkeletonGrid } from "@/components/ui/skeletons"
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

function SectionHeader({ icon: Icon, title, count, sort, onSortChange }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{count} {count === 1 ? "entry" : "entries"}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant={sort === "ALPHA_ASC" || sort === "ALPHA_DESC" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onSortChange(prev => prev === "ALPHA_ASC" ? "ALPHA_DESC" : "ALPHA_ASC")}
        >
          A-Z {sort === "ALPHA_ASC" ? "↑" : sort === "ALPHA_DESC" ? "↓" : ""}
        </Button>
        <Button
          variant={sort === "COUNT_DESC" || sort === "COUNT_ASC" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onSortChange(prev => prev === "COUNT_DESC" ? "COUNT_ASC" : "COUNT_DESC")}
        >
          Count {sort === "COUNT_DESC" ? "↓" : sort === "COUNT_ASC" ? "↑" : ""}
        </Button>
      </div>
    </div>
  )
}

function sortData(data, sort, keyFn) {
  const sorted = [...data]
  switch (sort) {
    case "COUNT_ASC":
      return sorted.sort((a, b) => keyFn(a).count - keyFn(b).count)
    case "ALPHA_ASC":
      return sorted.sort((a, b) => keyFn(a).label.localeCompare(keyFn(b).label))
    case "ALPHA_DESC":
      return sorted.sort((a, b) => keyFn(b).label.localeCompare(keyFn(a).label))
    case "COUNT_DESC":
    default:
      return sorted.sort((a, b) => keyFn(b).count - keyFn(a).count)
  }
}

export default function RecipientsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stateSort, setStateSort] = useState("COUNT_DESC")
  const [categorySort, setCategorySort] = useState("COUNT_DESC")

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
  const sortedStates = sortData(states, stateSort, (item) => ({ count: item.count, label: item.state }))
  const sortedCategories = sortData(categories, categorySort, ([, { count, categoryTitle }]) => ({ count, label: categoryTitle }))

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
          sort={categorySort}
          onSortChange={setCategorySort}
        />
        {loading ? (
          <SkeletonGrid count={3} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sortedCategories.map(([id, { count, categoryTitle }]) => (
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
          sort={stateSort}
          onSortChange={setStateSort}
        />
        {loading ? (
          <SkeletonGrid count={18} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sortedStates.map(({ state, count }) => (
              <StatCard key={state} title={formatStateName(state)} count={count} dim={Math.round((count / maxState) * 100)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
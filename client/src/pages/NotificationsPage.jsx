import { useEffect, useState, useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { getNotifications, deleteNotification, sendNotification } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Trash2, Loader2, Send, RefreshCw, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUSES = ["All", "pending", "sent"]
const ROW_HEIGHT = 72
const GRID_COLS =
  "44px minmax(0,1.5fr) minmax(0,1fr) 90px 90px 70px 70px 70px 120px 150px 150px 90px"

const HEADERS = ["#", "Product", "Body", "Priority", "Status", "Sent", "Failed", "Batch", "States", "Created", "Updated", "Actions"]
const CELL = "border-r border-border/50 px-3 flex items-center h-full overflow-hidden"

// ── Notification Detail Modal ───────────────────────────────────────────────
function NotificationDetailModal({ notification: n, open, onClose, onSend, onDelete, actionId }) {
  if (!n) return null

  const isSending = actionId === n._id + "-send"
  const isDeleting = actionId === n._id + "-del"
  const alreadySent = n.status === "sent"

  const detail = (label, value) => (
    <div key={label} className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-medium break-all">{value ?? "—"}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="flex h-[520px]">

          {/* Left — product image */}
          <div className="w-72 shrink-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 relative p-4">
            {n.product?.image_url
              ? <img
                  src={n.product.image_url}
                  alt={n.product?.name}
                  className="w-full h-64 object-contain rounded-lg"
                />
              : <Package className="w-16 h-16 text-slate-300" />
            }
            <p className="text-xs text-muted-foreground text-center leading-snug px-2">
              {n.product?.name}
            </p>
          </div>

          {/* Right — all notification details + actions */}
          <div className="flex flex-col flex-1 min-w-0">

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-base font-semibold leading-snug">
                  Notification Detail
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{n._id}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge variant={n.status === "sent" ? "success" : "secondary"}>{n.status}</Badge>
                <Badge variant={
                  n.priority === "high" ? "destructive" :
                  n.priority === "normal" ? "warning" : "success"
                }>
                  {n.priority}
                </Badge>
              </div>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
              {detail("Product", n.product?.name)}
              {detail("Body", n.body)}
              {detail("Priority", n.priority)}
              {detail("Status", n.status)}
              {detail("Sent Count", n.sent_count)}
              {detail("Failed Count", n.failed_count)}
              {detail("Current Batch", n.current_batch)}
              {detail("States", n.product?.state?.join(", "))}
              {detail("Created", n.created_at ? new Date(n.created_at).toLocaleString("en-IN") : null)}
              {detail("Updated", n.updated_at ? new Date(n.updated_at).toLocaleString("en-IN") : null)}
            </div>

            {/* Actions footer */}
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center gap-3">
              {!alreadySent && (
                <Button
                  className="gap-2 flex-1"
                  onClick={() => { onSend(n._id); onClose() }}
                  disabled={isSending}
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Now
                </Button>
              )}
              {alreadySent && (
                <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="w-4 h-4 text-green-500" />
                  Sent to {n.sent_count} recipient{n.sent_count !== 1 ? "s" : ""}
                </div>
              )}
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => { onDelete(n._id); onClose() }}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")
  const [actionId, setActionId] = useState(null)
  const [detailNotif, setDetailNotif] = useState(null)

  const scrollRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (status !== "All") params.status = status
      const res = await getNotifications(params)
      setNotifications(res.data.notifications || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this notification?")) return
    setActionId(id + "-del")
    try {
      await deleteNotification(id)
      fetchNotifications()
    } finally {
      setActionId(null)
    }
  }, [fetchNotifications])

  const handleSend = useCallback(async (id) => {
    if (!window.confirm("Send this notification now?")) return
    setActionId(id + "-send")
    try {
      await sendNotification(id)
      fetchNotifications()
    } catch (e) {
      alert(e.response?.data?.message || "Failed")
    } finally {
      setActionId(null)
    }
  }, [fetchNotifications])

  const rowVirtualizer = useVirtualizer({
    count: notifications.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto">

      {/* Notification detail modal */}
      <NotificationDetailModal
        notification={detailNotif}
        open={!!detailNotif}
        onClose={() => setDetailNotif(null)}
        onSend={handleSend}
        onDelete={handleDelete}
        actionId={actionId}
      />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{notifications.length} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchNotifications}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No notifications</div>
          ) : (
            <div className="flex flex-col">

              {/* Sticky header */}
              <div
                style={{ gridTemplateColumns: GRID_COLS }}
                className="grid border-b bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 z-10"
              >
                {HEADERS.map((h) => (
                  <div
                    key={h}
                    className={cn(
                      "px-3 py-3 flex items-center",
                      h === "#" && "justify-center",
                      h === "Actions" ? "justify-end" : "border-r border-border/50"
                    )}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Virtualised rows */}
              <div ref={scrollRef} className="overflow-y-auto scrollbar-thin" style={{ height: 600 }}>
                <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map((vRow) => {
                    const n = notifications[vRow.index]

                    return (
                      <div
                        key={n._id}
                        data-index={vRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: vRow.start,
                          left: 0,
                          right: 0,
                          height: ROW_HEIGHT,
                          gridTemplateColumns: GRID_COLS,
                        }}
                        className={cn(
                          "grid border-b hover:bg-muted/30 transition-colors",
                          vRow.index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/20"
                        )}
                      >
                        {/* # */}
                        <div className={cn(CELL, "justify-center text-xs text-muted-foreground font-mono select-none")}>
                          {vRow.index + 1}
                        </div>

                        {/* Product — click image to open modal */}
                        <div className={cn(CELL, "gap-3")}>
                          <button
                            type="button"
                            title="View details"
                            onClick={() => setDetailNotif(n)}
                            className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center ring-0 hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                          >
                            {n.product?.image_url
                              ? <img src={n.product.image_url} className="w-full h-full object-cover" alt="" />
                              : <Package className="w-5 h-5 text-slate-400" />}
                          </button>
                          <span
                            className="truncate text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setDetailNotif(n)}
                          >
                            {n.product?.name}
                          </span>
                        </div>

                        {/* Body */}
                        <div className={cn(CELL)}>
                          <span className="text-sm truncate">{n.body || "—"}</span>
                        </div>

                        {/* Priority */}
                        <div className={cn(CELL)}>
                          <Badge variant={n.priority === "high" ? "destructive" : n.priority === "normal" ? "warning" : "success"}>
                            {n.priority}
                          </Badge>
                        </div>

                        {/* Status */}
                        <div className={cn(CELL)}>
                          <Badge variant={n.status === "sent" ? "success" : "secondary"}>{n.status}</Badge>
                        </div>

                        <div className={cn(CELL, "text-sm")}>{n.sent_count}</div>
                        <div className={cn(CELL, "text-sm")}>{n.failed_count}</div>
                        <div className={cn(CELL, "text-sm")}>{n.current_batch}</div>

                        {/* States */}
                        <div className={cn(CELL)}>
                          <span className="text-xs truncate">{n.product?.state?.join(", ") || "—"}</span>
                        </div>

                        {/* Created */}
                        <div className={cn(CELL)}>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Updated */}
                        <div className={cn(CELL)}>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.updated_at).toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Inline actions + detail opener */}
                        <div className="px-2 flex items-center justify-end gap-0.5 h-full">
                          {n.status !== "sent" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Send"
                              onClick={() => handleSend(n._id)}
                              disabled={actionId === n._id + "-send"}
                            >
                              {actionId === n._id + "-send"
                                ? <Loader2 className="animate-spin w-4 h-4" />
                                : <Send className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            onClick={() => handleDelete(n._id)}
                            disabled={actionId === n._id + "-del"}
                          >
                            {actionId === n._id + "-del"
                              ? <Loader2 className="animate-spin w-4 h-4" />
                              : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
import { useEffect, useState, useCallback } from "react"
import { getNotifications, deleteNotification, sendNotification } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Trash2, Loader2, Send, RefreshCw, Package, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUSES = ["All", "pending", "sent"]
const PAGE_SIZE = 50

// ── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-xs text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ── Notification Detail Modal ────────────────────────────────────────────────
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
          <div className="w-72 shrink-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-3 p-4">
            {n.product?.image_url
              ? <img src={n.product.image_url} alt={n.product?.name} className="w-full h-64 object-contain rounded-lg" />
              : <Package className="w-16 h-16 text-slate-300" />}
            <p className="text-xs text-muted-foreground text-center leading-snug px-2">{n.product?.name}</p>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-6 pt-5 pb-4 border-b flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-base font-semibold leading-snug">Notification Detail</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{n._id}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge variant={n.status === "sent" ? "success" : "secondary"}>{n.status}</Badge>
                <Badge variant={n.priority === "high" ? "destructive" : n.priority === "normal" ? "warning" : "success"}>{n.priority}</Badge>
              </div>
            </div>
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
            <div className="px-6 py-4 border-t bg-muted/30 flex items-center gap-3">
              {!alreadySent && (
                <Button className="gap-2 flex-1" onClick={() => { onSend(n._id); onClose() }} disabled={isSending}>
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
              <Button variant="destructive" className="gap-2" onClick={() => { onDelete(n._id); onClose() }} disabled={isDeleting}>
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")
  const [actionId, setActionId] = useState(null)
  const [detailNotif, setDetailNotif] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchNotifications = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = { page: p, limit: PAGE_SIZE }
      if (search) params.search = search
      if (status !== "All") params.status = status
      const res = await getNotifications(params)
      setNotifications(res.data.notifications || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, status, page])

  useEffect(() => { setPage(1) }, [search, status])
  useEffect(() => { fetchNotifications(page) }, [page, search, status])

  const handlePageChange = (p) => { setPage(p); window.scrollTo(0, 0) }

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("Delete this notification?")) return
    setActionId(id + "-del")
    try { await deleteNotification(id); fetchNotifications(page) }
    finally { setActionId(null) }
  }, [fetchNotifications, page])

  const handleSend = useCallback(async (id) => {
    if (!window.confirm("Send this notification now?")) return
    setActionId(id + "-send")
    try { await sendNotification(id); fetchNotifications(page) }
    catch (e) { alert(e.response?.data?.message || "Failed") }
    finally { setActionId(null) }
  }, [fetchNotifications, page])

  const startRow = (page - 1) * PAGE_SIZE + 1

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <NotificationDetailModal
        notification={detailNotif}
        open={!!detailNotif}
        onClose={() => setDetailNotif(null)}
        onSend={handleSend}
        onDelete={handleDelete}
        actionId={actionId}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => fetchNotifications(page)}>
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                      <th className="px-3 py-3 text-center w-10 border-r border-border/50">#</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 min-w-[200px]">Product</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 min-w-[160px]">Body</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-24">Priority</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-24">Status</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-16">Sent</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-16">Failed</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-16">Batch</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-28">States</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-36">Created</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-36">Updated</th>
                      <th className="px-3 py-3 text-right w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n, idx) => (
                      <tr
                        key={n._id}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors",
                          idx % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/20"
                        )}
                      >
                        <td className="px-3 py-0 text-center text-xs text-muted-foreground font-mono border-r border-border/50 h-[72px]">
                          {startRow + idx}
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px]">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setDetailNotif(n)}
                              className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                            >
                              {n.product?.image_url
                                ? <img src={n.product.image_url} className="w-full h-full object-cover" alt="" />
                                : <Package className="w-5 h-5 text-slate-400" />}
                            </button>
                            <span
                              className="truncate text-sm font-medium cursor-pointer hover:text-primary transition-colors max-w-[160px] block"
                              onClick={() => setDetailNotif(n)}
                            >
                              {n.product?.name}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px] max-w-[160px]">
                          <span className="text-sm truncate block">{n.body || "—"}</span>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px]">
                          <Badge variant={n.priority === "high" ? "destructive" : n.priority === "normal" ? "warning" : "success"}>
                            {n.priority}
                          </Badge>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px]">
                          <Badge variant={n.status === "sent" ? "success" : "secondary"}>{n.status}</Badge>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px] text-sm">{n.sent_count}</td>
                        <td className="px-3 border-r border-border/50 h-[72px] text-sm">{n.failed_count}</td>
                        <td className="px-3 border-r border-border/50 h-[72px] text-sm">{n.current_batch}</td>

                        <td className="px-3 border-r border-border/50 h-[72px] max-w-[112px]">
                          <span className="text-xs truncate block">{n.product?.state?.join(", ") || "—"}</span>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px]">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(n.created_at).toLocaleString("en-IN")}
                          </span>
                        </td>

                        <td className="px-3 border-r border-border/50 h-[72px]">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(n.updated_at).toLocaleString("en-IN")}
                          </span>
                        </td>

                        <td className="px-2 h-[72px]">
                          <div className="flex items-center justify-end gap-0.5">
                            {n.status !== "sent" && (
                              <Button size="icon" variant="ghost" title="Send" onClick={() => handleSend(n._id)} disabled={actionId === n._id + "-send"}>
                                {actionId === n._id + "-send" ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(n._id)} disabled={actionId === n._id + "-del"}>
                              {actionId === n._id + "-del" ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {startRow}–{Math.min(startRow + PAGE_SIZE - 1, total)} of {total.toLocaleString()}
                </span>
                <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
import { useEffect, useState, useRef, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { getProducts, createNotification } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "react-hot-toast"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Package, Loader2, RefreshCw, CheckSquare, Square, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

const CATEGORIES = ["All", "Electronics", "Fashion", "Grocery", "Home", "Beauty", "Sports", "Other"]
const ROW_HEIGHT = 72
const GRID_COLS = "44px 44px 400px 220px 110px 110px 180px 120px 110px 140px"
const CELL = "border-r border-border/50 px-3 flex items-center h-full"

// ── Product Detail Modal ────────────────────────────────────────────────────
function ProductDetailModal({ product, open, onClose, onCreateNotification }) {
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState("normal")

  // Reset fields when a new product is opened
  useEffect(() => {
    if (product) { setBody(""); setPriority("normal") }
  }, [product])

  if (!product) return null

  const handleCreate = () => {
    onCreateNotification([{
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      state: product.state,
      body,
      priority,
    }])
    onClose()
  }

  const detail = (label, value) => (
    <div key={label} className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="font-medium break-all">{value ?? "—"}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="flex h-[520px]">

          {/* Left — full image */}
          <div className="w-72 shrink-0 bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative">
            {product.imageUrl
              ? <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain p-4"
              />
              : <Package className="w-16 h-16 text-slate-300" />
            }
          </div>

          {/* Right — details + action */}
          <div className="flex flex-col flex-1 min-w-0">

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b">
              <DialogTitle className="text-base font-semibold leading-snug pr-6">
                {product.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {product.id}</p>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
              {detail("Category", product.category)}
              {detail("Brand", product.brand)}
              {detail("Price", product.price != null ? `₹${Number(product.price).toLocaleString()}` : null)}
              {detail("Avl. Stock", product.avlStock)}
              {detail("SKU UIC", product.skuUic)}
              {detail("View Count", product.viewCount?.toLocaleString())}
              {detail("State(s)", Array.isArray(product.state) ? product.state.join(", ") : product.state)}
              {detail("Status", product.status)}
              {detail("Grade", product.grade)}
              {/* Render any extra keys not explicitly listed above */}
              {/* {Object.entries(product)
                .filter(([k]) => ![
                  "id", "_id", "name", "imageUrl", "image_url", "category", "brand",
                  "price", "avlStock", "viewCount", "state", "status", "sku_uic", "grade"
                ].includes(k))
                .map(([k, v]) =>
                  detail(k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "—"))
                )
              } */}
            </div>

            {/* Notification composer */}
            <div className="px-6 py-4 border-t bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Create Notification
              </p>
              <Input
                placeholder="Notification body (e.g. Now Live!)"
                className="h-8 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="gap-1.5 flex-1" onClick={handleCreate}>
                  <Plus className="w-3.5 h-3.5" />
                  Create Notification
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [status, setStatus] = useState("All")
  const [selected, setSelected] = useState(new Set())
  const [notifBodies, setNotifBodies] = useState({})
  const [priorities, setPriorities] = useState({})
  const [detailProduct, setDetailProduct] = useState(null)

  const scrollRef = useRef(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (category !== "All") params.category = category
      if (status !== "All") params.status = status
      const res = await getProducts(params)
      setProducts(res.data.products || res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [search, category, status])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const allVisible = products.length > 0 && products.every((p) => selected.has(p.id))
  const someSelected = selected.size > 0

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (products.every((p) => prev.has(p.id))) {
        products.forEach((p) => next.delete(p.id))
      } else {
        products.forEach((p) => next.add(p.id))
      }
      return next
    })
  }, [products])

  const handleCreateNotification = useCallback(async (payload) => {
    toast.promise(
      createNotification(payload),
      {
        loading: "Creating notifications…",
        success: () => {
          setSelected(new Set())
          setNotifBodies({})
          return `${payload.length} notification${payload.length !== 1 ? "s" : ""} created`
        },
        error: (e) => e?.response?.data?.message || "Failed to create notification",
      },
      { position: "top-center" }
    )
  }, [])

  const handleCreateFromTable = () => {
    if (!selected.size) return
    const payload = products
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        state: p.state,
        skuUic: p.skuUic,
        body: notifBodies[p.id] || "",
        priority: priorities[p.id] || "normal",
        grade: p.grade,
        brand: p.brand,
        price: p.price,
      }))
    handleCreateNotification(payload)
  }

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto">

      {/* Product detail modal */}
      <ProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onCreateNotification={handleCreateNotification}
      />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {products.length.toLocaleString()} total products
          </p>
        </div>
        <Button onClick={handleCreateFromTable} disabled={!someSelected} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Notification
          {someSelected && (
            <span className="ml-1 bg-primary-foreground/20 text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
              {selected.size}
            </span>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c === "All" ? "All Categories" : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchProducts} title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No products found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="flex flex-col">

              {/* Sticky header */}
              <div
                style={{ gridTemplateColumns: GRID_COLS }}
                className="grid border-b bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 z-10"
              >
                <div className="border-r border-border/50 px-3 py-3 flex items-center justify-center">#</div>
                <div className="border-r border-border/50 px-3 py-3 flex items-center justify-center">
                  <button onClick={toggleAll} className="hover:text-foreground transition-colors">
                    {allVisible ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                </div>
                {["Product (Notification Title)", "Notification Body", "View Count", "Avl. Stock", "Category", "Price", "Priority"].map((label, i, arr) => (
                  <div key={label} className={cn("px-3 py-3 flex items-center", i < arr.length - 1 && "border-r border-border/50")}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Virtualised rows */}
              <div
                ref={scrollRef}
                className="overflow-y-auto scrollbar-thin"
                style={{ height: Math.min(products.length * ROW_HEIGHT, 600) }}
              >
                <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map((vRow) => {
                    const p = products[vRow.index]
                    const isSelected = selected.has(p.id)

                    return (
                      <div
                        key={p.id}
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
                          "grid border-b last:border-0 transition-colors",
                          isSelected
                            ? "bg-primary/5 dark:bg-primary/10"
                            : vRow.index % 2 === 0
                              ? "bg-white dark:bg-background"
                              : "bg-muted/20"
                        )}
                      >
                        {/* # */}
                        <div className={cn(CELL, "justify-center text-xs text-muted-foreground font-mono select-none")}>
                          {vRow.index + 1}
                        </div>

                        {/* Checkbox */}
                        <div className={cn(CELL, "justify-center cursor-pointer")} onClick={() => toggleOne(p.id)}>
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground" />}
                        </div>

                        {/* Product image + name — click image opens modal, click name toggles */}
                        <div className={cn(CELL, "gap-3")}>
                          <button
                            type="button"
                            title="View details"
                            onClick={(e) => { e.stopPropagation(); setDetailProduct(p) }}
                            className="w-14 h-14 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 overflow-hidden ring-0 hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                          >
                            {p.imageUrl
                              ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                              : <Package className="w-5 h-5 text-blue-500" />}
                          </button>
                          <span
                            className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => toggleOne(p.id)}
                          >
                            {p.name}
                          </span>
                        </div>

                        {/* Notification body */}
                        <div className={cn(CELL)} onClick={(e) => e.stopPropagation()}>
                          <Input
                            placeholder="Now Live!"
                            className="h-8 text-xs w-full"
                            value={notifBodies[p.id] || ""}
                            onChange={(e) => setNotifBodies((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          />
                        </div>

                        <div className={cn(CELL, "text-sm text-muted-foreground")}>{(p.viewCount ?? 0).toLocaleString()}</div>
                        <div className={cn(CELL, "text-sm text-muted-foreground")}>{p.avlStock ?? "—"}</div>
                        <div className={cn(CELL, "text-sm text-muted-foreground truncate")}>{p.category || "—"}</div>
                        <div className={cn(CELL, "text-sm font-mono")}>₹{(p.price ?? 0).toLocaleString()}</div>

                        {/* Priority */}
                        <div className="px-3 flex items-center h-full" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={priorities[p.id] || "normal"}
                            onValueChange={(val) => setPriorities((prev) => ({ ...prev, [p.id]: val }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {products.length.toLocaleString()} rows
                  {someSelected && <span className="ml-2 text-primary font-medium">· {selected.size} selected</span>}
                </span>
                {someSelected && (
                  <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
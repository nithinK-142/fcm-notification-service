import { useEffect, useState, useCallback } from "react"
import { getProducts, createNotification } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "react-hot-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Package, Loader2, RefreshCw, CheckSquare, Square, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_SIZES = [25, 50, 100, 300, 500]
const DEFAULT_PAGE_SIZE = 25

// ── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Rows</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <>
          <span className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Product Detail Modal ─────────────────────────────────────────────────────
function ProductDetailModal({ product, open, onClose, onCreateNotification, creating }) {
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState("normal")

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
      skuUic: product.skuUic,
      body,
      priority,
      grade: product.grade,
      brand: product.brand,
      price: product.price,
      category: product.category,
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
          <div className="w-72 shrink-0 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-4" />
              : <Package className="w-16 h-16 text-slate-300" />}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-6 pt-5 pb-4 border-b">
              <DialogTitle className="text-base font-semibold leading-snug pr-6">{product.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {product.id}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
              {detail("Registration Category", product.category?.registration?.categoryTitle ?? "-")}
              {detail("Main Category", product.category?.main?.categoryTitle ?? "-")}
              {detail("Sub Category", product.category?.sub?.categoryTitle ?? "-")}
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
            <div className="px-6 py-4 border-t bg-muted/30 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Create Notification</p>
              <Input
                placeholder={`Notification body (e.g. Now LIVE ${product.price})`}
                className="h-8 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="gap-1.5 flex-1" onClick={handleCreate} disabled={creating}>
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [selected, setSelected] = useState(new Set())
  const [notifBodies, setNotifBodies] = useState({})
  const [priorities, setPriorities] = useState({})
  const [detailProduct, setDetailProduct] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState([])

  const fetchProducts = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true)
    try {
      const body = { page: p, limit: ps }
      if (debouncedSearch.trim()) body.search = debouncedSearch.trim()
      if (category !== "All") body.category = category
      const res = await getProducts(body)
      setProducts(res.data.products || [])
      setTotal(res.data.pagination.total || 0)
      setTotalPages(res.data.pagination.totalPages || 1)
      setCategories(res.data.categories || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [debouncedSearch, category, page])

  useEffect(() => { setPage(1) }, [debouncedSearch, category, pageSize])
  useEffect(() => { fetchProducts(page, pageSize) }, [page, pageSize, debouncedSearch, category])

  const handlePageChange = (p) => { setPage(p); setSelected(new Set()); window.scrollTo(0, 0) }
  const handlePageSizeChange = (s) => { setPageSize(s); setPage(1); setSelected(new Set()) }

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
    if (creating) return
    setCreating(true)
    try {
      await toast.promise(
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
    } finally {
      setCreating(false)
    }
  }, [creating])

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
        category: p.category,
      }))
    handleCreateNotification(payload)
  }

  const startRow = (page - 1) * pageSize + 1

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search) }, 400)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <ProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onCreateNotification={handleCreateNotification}
        creating={creating}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total products</p>
        </div>
        <Button onClick={handleCreateFromTable} disabled={!someSelected || creating} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Notification
          {someSelected && (
            <span className="ml-1 bg-primary-foreground/20 text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
              {selected.size}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {setSearch(""); setDebouncedSearch(""); setCategory("All"); setPage(1);}}
          title="Refresh"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                      <th className="px-3 py-3 text-center w-10 border-r border-border/50">#</th>
                      <th className="px-3 py-3 text-center w-10 border-r border-border/50">
                        <button onClick={toggleAll} className="hover:text-foreground transition-colors flex items-center justify-center">
                          {allVisible ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left border-r border-border/50 min-w-[260px]">Product (Notification Title)</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-52">Notification Body</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-28">View Count</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-28">Avl. Stock</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-40">Category</th>
                      <th className="px-3 py-3 text-left border-r border-border/50 w-28">Price</th>
                      <th className="px-3 py-3 text-left w-28">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, idx) => {
                      const isSelected = selected.has(p.id)
                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "border-b last:border-0 transition-colors",
                            isSelected
                              ? "bg-primary/5 dark:bg-primary/10"
                              : idx % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/20"
                          )}
                        >
                          <td className="px-3 text-center text-xs text-muted-foreground font-mono border-r border-border/50 h-[72px]">
                            {startRow + idx}
                          </td>

                          <td className="px-3 text-center border-r border-border/50 h-[72px] cursor-pointer" onClick={() => toggleOne(p.id)}>
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-primary mx-auto" />
                              : <Square className="w-4 h-4 text-muted-foreground mx-auto" />}
                          </td>

                          <td className="px-3 border-r border-border/50 h-[72px]">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDetailProduct(p) }}
                                className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
                              >
                                {p.imageUrl
                                  ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                                  : <Package className="w-5 h-5 text-blue-500" />}
                              </button>
                              <span
                                className="text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors max-w-[180px] block"
                                onClick={() => toggleOne(p.id)}
                              >
                                {p.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 border-r border-border/50 h-[72px]" onClick={(e) => e.stopPropagation()}>
                            <Input
                              placeholder={`Now LIVE ${p.price ?? 0}`}
                              className="h-8 text-xs w-full"
                              value={notifBodies[p.id] || ""}
                              onChange={(e) => setNotifBodies((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                          </td>

                          <td className="px-3 border-r border-border/50 h-[72px] text-sm text-muted-foreground">{(p.viewCount ?? 0).toLocaleString()}</td>
                          <td className="px-3 border-r border-border/50 h-[72px] text-sm text-muted-foreground">{p.avlStock ?? "—"}</td>
                          <td className="px-3 border-r border-border/50 h-[72px] text-sm text-muted-foreground">{p.category.registration.categoryTitle || "—"}</td>
                          <td className="px-3 border-r border-border/50 h-[72px] text-sm font-mono">₹{(p.price ?? 0).toLocaleString()}</td>

                          <td className="px-3 h-[72px]" onClick={(e) => e.stopPropagation()}>
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
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Showing {startRow}–{Math.min(startRow + pageSize - 1, total)} of {total.toLocaleString()}
                  {someSelected && <span className="ml-2 text-primary font-medium">· {selected.size} selected</span>}
                </span>
                <div className="flex items-center gap-4">
                  {someSelected && (
                    <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Clear selection
                    </button>
                  )}
                  <Pagination page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
import { cn } from "@/lib/utils"

export function Skel({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/60", className)} />
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {[...Array(count)].map((_, i) => <Skel key={i} className="h-24" />)}
    </div>
  )
}
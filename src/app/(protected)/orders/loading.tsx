export default function Loading() {
  return (
    <div className="animate-pulse p-4 sm:p-6" aria-busy aria-label="Loading orders">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-10 w-36 rounded-full" />
      </div>
      <div className="skeleton mt-4 h-11" />
      <div className="skeleton mt-4 h-28" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="animate-pulse p-4 sm:p-6" aria-busy aria-label="Loading stock">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-10 w-32 rounded-full" />
      </div>
      <div className="skeleton mt-4 h-11" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-36" />
        ))}
      </div>
    </div>
  )
}

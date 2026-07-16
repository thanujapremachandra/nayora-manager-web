// Instant-paint skeleton for the dashboard (and fallback for any protected
// route without its own loading boundary). Navigation feels immediate while
// the server streams real data.
export default function Loading() {
  return (
    <div className="animate-pulse p-4 sm:p-6" aria-busy aria-label="Loading">
      <div className="skeleton h-8 w-44" />
      <div className="mt-2 h-4 w-64 rounded-lg bg-gray-200/60" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>

      <div className="skeleton mt-4 h-44" />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8" aria-busy aria-label="Loading settings">
      <div className="skeleton h-8 w-36" />
      <div className="mt-2 h-4 w-72 rounded-lg bg-gray-200/60" />
      <div className="skeleton mt-6 h-11 w-96 max-w-full rounded-full" />
      <div className="mt-6 max-w-2xl space-y-6">
        <div className="skeleton h-64" />
        <div className="skeleton h-40" />
      </div>
    </div>
  )
}

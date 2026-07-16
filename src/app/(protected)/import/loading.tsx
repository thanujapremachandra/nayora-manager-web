export default function Loading() {
  return (
    <div className="animate-pulse p-4 sm:p-6" aria-busy aria-label="Loading import">
      <div className="skeleton h-8 w-44" />
      <div className="mt-2 h-4 w-80 rounded-lg bg-gray-200/60" />
      <div className="skeleton mt-6 h-32" />
    </div>
  )
}

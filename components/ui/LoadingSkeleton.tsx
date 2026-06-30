type LoadingSkeletonProps = {
  className?: string
}

export function LoadingSkeleton({
  className = 'animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700',
}: LoadingSkeletonProps) {
  return <div className={className} />
}

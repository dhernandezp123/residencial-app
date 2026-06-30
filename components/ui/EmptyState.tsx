import type { ReactNode } from 'react'

type EmptyStateProps = {
  children?: ReactNode
  title?: string
  description?: string
  className?: string
}

export function EmptyState({
  children,
  title,
  description,
  className = 'rounded-2xl bg-white p-6 text-sm leading-6 text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400',
}: EmptyStateProps) {
  return (
    <section className={className}>
      {title && (
        <h2 className="text-base font-bold text-slate-950 dark:text-white">
          {title}
        </h2>
      )}
      {description && <p className={title ? 'mt-2' : ''}>{description}</p>}
      {children}
    </section>
  )
}

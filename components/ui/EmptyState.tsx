import type { ReactNode } from 'react'

type EmptyStateProps = {
  children?: ReactNode
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  children,
  icon,
  title,
  description,
  action,
  className = 'rounded-2xl bg-white p-6 text-center text-sm leading-6 text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400',
}: EmptyStateProps) {
  return (
    <section className={className}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF6F0] text-[#15936A]">
          {icon}
        </div>
      )}
      {title && (
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          {title}
        </h2>
      )}
      {description && <p className={title ? 'mt-2' : ''}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
      {children}
    </section>
  )
}

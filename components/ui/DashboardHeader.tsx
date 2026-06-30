import type { ReactNode } from 'react'

type DashboardHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
}

export function DashboardHeader({
  eyebrow,
  title,
  subtitle,
  children,
  className = 'rounded-2xl bg-slate-950 p-6 text-white shadow-lg dark:bg-slate-800',
}: DashboardHeaderProps) {
  return (
    <header className={className}>
      {eyebrow && <p className="text-sm text-slate-300">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
      )}
      {children}
    </header>
  )
}

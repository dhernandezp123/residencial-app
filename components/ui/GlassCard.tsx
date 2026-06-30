import type { ElementType, ReactNode } from 'react'

type GlassCardProps = {
  children: ReactNode
  as?: ElementType
  className?: string
}

export function GlassCard({
  children,
  as: Component = 'section',
  className = '',
}: GlassCardProps) {
  return (
    <Component
      className={`rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-200/70 backdrop-blur-xl transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-800/85 dark:shadow-black/20 ${className}`}
    >
      {children}
    </Component>
  )
}
